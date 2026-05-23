from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import numpy as np
from google import genai
import os
import io
import re
from dotenv import load_dotenv

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Palabras que indican columnas ID/clave — no útiles para gráficas
ID_KEYWORDS = re.compile(r"key|id|code|number|num|order|line|serial|index|idx|sku", re.I)


def clean_datetime_series(series: pd.Series) -> pd.Series:
    """Limpia formatos de fecha en español como '12/01/2020 12:00:00 a. m.'"""
    cleaned = (
        series.astype(str)
        .str.replace(r"\s*a\.\s*m\.", " AM", regex=True)
        .str.replace(r"\s*p\.\s*m\.", " PM", regex=True)
    )
    return cleaned


def detect_col_type(series: pd.Series) -> str:
    if pd.api.types.is_datetime64_any_dtype(series):
        return "date"
    if pd.api.types.is_numeric_dtype(series):
        return "numeric"
    sample = series.dropna().head(30).astype(str)
    try:
        cleaned = clean_datetime_series(sample)
        parsed = pd.to_datetime(cleaned, dayfirst=True, errors="coerce")
        if parsed.notna().mean() >= 0.8:
            return "date"
    except Exception:
        pass
    return "categorical"


def is_id_column(col_name: str, series: pd.Series) -> bool:
    """True si la columna parece un identificador sin valor analítico."""
    if ID_KEYWORDS.search(col_name):
        return True
    if pd.api.types.is_numeric_dtype(series):
        nunique = series.nunique()
        if nunique / max(len(series), 1) > 0.9:
            return True
    return False


def parse_dates(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    for col in df.columns:
        if detect_col_type(df[col]) == "date" and not pd.api.types.is_datetime64_any_dtype(df[col]):
            cleaned = clean_datetime_series(df[col])
            df[col] = pd.to_datetime(cleaned, dayfirst=True, errors="coerce")
    return df


def get_metric_cols(df: pd.DataFrame) -> list:
    return [
        c for c in df.columns
        if pd.api.types.is_numeric_dtype(df[c]) and not is_id_column(c, df[c])
    ]


def get_category_cols(df: pd.DataFrame) -> list:
    return [
        c for c in df.columns
        if detect_col_type(df[c]) == "categorical" and not is_id_column(c, df[c])
        and df[c].nunique() <= 50
    ]


def get_date_cols(df: pd.DataFrame) -> list:
    return [c for c in df.columns if pd.api.types.is_datetime64_any_dtype(df[c])]


def build_chart_data(df: pd.DataFrame) -> list:
    charts = []
    metric_cols = get_metric_cols(df)
    cat_cols = get_category_cols(df)
    date_cols = get_date_cols(df)

    # Bar chart: mejor métrica por mejor categoría
    if cat_cols and metric_cols:
        cat_col = cat_cols[0]
        metric_col = metric_cols[0]
        grouped = (
            df.groupby(cat_col)[metric_col]
            .sum()
            .sort_values(ascending=False)
            .head(10)
            .reset_index()
        )
        grouped.columns = ["name", "value"]
        grouped["name"] = grouped["name"].astype(str)
        charts.append({
            "type": "bar",
            "title": f"{metric_col} por {cat_col}",
            "data": grouped.to_dict("records"),
        })

    # Line chart: métrica principal a lo largo del tiempo
    if date_cols and metric_cols:
        date_col = date_cols[0]
        metric_col = metric_cols[0]
        temp = df[[date_col, metric_col]].dropna()
        temp["_period"] = temp[date_col].dt.to_period("M").astype(str)
        grouped = temp.groupby("_period")[metric_col].sum().reset_index()
        grouped.columns = ["name", "value"]
        if len(grouped) >= 2:
            charts.append({
                "type": "line",
                "title": f"{metric_col} por mes",
                "data": grouped.to_dict("records"),
            })

    # Histogram: distribución de la métrica principal
    if metric_cols:
        col = metric_cols[0]
        data_clean = df[col].dropna()
        counts, edges = np.histogram(data_clean, bins=10)
        hist_data = [
            {"name": f"{edges[i]:,.0f}", "value": int(counts[i])}
            for i in range(len(counts))
        ]
        charts.append({
            "type": "histogram",
            "title": f"Distribución de {col}",
            "data": hist_data,
        })

    # Pie: composición de segunda categoría o la primera
    if len(cat_cols) >= 2:
        col = cat_cols[1]
    elif cat_cols:
        col = cat_cols[0]
    else:
        col = None

    if col:
        counts = df[col].value_counts().head(6).reset_index()
        counts.columns = ["name", "value"]
        counts["name"] = counts["name"].astype(str)
        charts.append({
            "type": "pie",
            "title": f"Composición: {col}",
            "data": counts.to_dict("records"),
        })

    return charts


def build_summary_for_ai(df: pd.DataFrame) -> str:
    metric_cols = get_metric_cols(df)
    cat_cols = get_category_cols(df)
    date_cols = get_date_cols(df)

    lines = [f"Dataset con {len(df):,} filas y {len(df.columns)} columnas.\n"]

    if date_cols:
        for col in date_cols[:2]:
            rng = f"{df[col].min().date()} → {df[col].max().date()}"
            lines.append(f"Período de datos ({col}): {rng}")

    if metric_cols:
        lines.append("\nMétricas principales:")
        for col in metric_cols[:5]:
            s = df[col].dropna()
            lines.append(
                f"  {col}: total={s.sum():,.2f}, promedio={s.mean():,.2f}, "
                f"min={s.min():,.2f}, max={s.max():,.2f}"
            )

    if cat_cols:
        lines.append("\nCategorizaciones:")
        for col in cat_cols[:3]:
            top = df[col].value_counts().head(3).to_dict()
            lines.append(f"  {col} ({df[col].nunique()} únicos): top 3 = {top}")

    return "\n".join(lines)


def generate_local_insights(df: pd.DataFrame) -> str:
    metric_cols = get_metric_cols(df)
    cat_cols = get_category_cols(df)
    date_cols = get_date_cols(df)
    lines = ["**Resumen ejecutivo**\n"]

    if date_cols and metric_cols:
        col = metric_cols[0]
        date_col = date_cols[0]
        lines.append(
            f"El dataset cubre el período {df[date_col].min().date()} → {df[date_col].max().date()} "
            f"con {len(df):,} registros y un total de {df[col].sum():,.2f} en {col}."
        )

    if metric_cols:
        lines.append("\n**Insights clave:**")
        for col in metric_cols[:4]:
            s = df[col].dropna()
            lines.append(f"- {col}: total {s.sum():,.2f} · promedio {s.mean():,.2f} · máx {s.max():,.2f}")

        if len(metric_cols) >= 2:
            top_col = metric_cols[0]
            monthly = df.groupby(df[date_cols[0]].dt.to_period("M"))[top_col].sum() if date_cols else None
            if monthly is not None and len(monthly) > 0:
                best_month = monthly.idxmax()
                lines.append(f"- El mejor mes en {top_col} fue {best_month} con {monthly.max():,.2f}")

    if cat_cols:
        for col in cat_cols[:2]:
            top_val = df[col].value_counts().idxmax()
            top_pct = df[col].value_counts(normalize=True).max() * 100
            lines.append(f"- La categoría dominante en '{col}' es '{top_val}' ({top_pct:.1f}% del total)")

    nulls = df.isna().sum().sum()
    if nulls > 0:
        lines.append(f"- Se detectaron {int(nulls):,} campos vacíos — revisar calidad del dato")

    lines.append("\n**Recomendación principal**")
    if metric_cols:
        lines.append(f"Profundizar en el análisis de {metric_cols[0]} segmentado por período y categoría para identificar tendencias accionables.")

    return "\n".join(lines)


def read_file(filename: str, content: bytes) -> pd.DataFrame:
    """Lee CSV o Excel probando múltiples encodings y opciones de parsing."""
    name = filename.lower()

    # ── Excel ────────────────────────────────────────────────────────────────
    if name.endswith((".xlsx", ".xls")):
        return pd.read_excel(io.BytesIO(content))

    # ── CSV: matriz de encodings × opciones de parsing ────────────────────────
    ENCODINGS = ["utf-8-sig", "utf-8", "latin-1", "cp1252", "iso-8859-1", "utf-16"]

    # Cada intento es un dict de kwargs extra para read_csv
    PARSE_OPTS = [
        {},                                                          # estándar
        {"on_bad_lines": "skip"},                                    # saltea filas rotas
        {"quoting": 3, "on_bad_lines": "skip"},                      # QUOTE_NONE
        {"quoting": 3, "on_bad_lines": "skip", "escapechar": "\\"},  # QUOTE_NONE + escape
    ]

    last_err: Exception | None = None
    for enc in ENCODINGS:
        for opts in PARSE_OPTS:
            try:
                df = pd.read_csv(
                    io.BytesIO(content),
                    sep=None,
                    engine="python",
                    encoding=enc,
                    **opts,
                )
                if not df.empty:
                    return df
            except Exception as e:
                last_err = e

    raise last_err or ValueError("No se pudo parsear el archivo")


@app.post("/analyze")
async def analyze(file: UploadFile = File(...)):
    ALLOWED = (".csv", ".xlsx", ".xls")
    if not any(file.filename.lower().endswith(ext) for ext in ALLOWED):
        raise HTTPException(status_code=400, detail="Solo se aceptan archivos CSV o Excel (.xlsx)")

    content = await file.read()
    try:
        df = read_file(file.filename, content)
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="No se pudo leer el archivo. Verifica que sea un CSV o Excel válido."
        )

    if df.empty:
        raise HTTPException(status_code=400, detail="El CSV está vacío")

    # Parsear fechas
    df = parse_dates(df)

    # Preview
    preview = df.head(5).astype(str).replace("NaT", None).replace("nan", None).to_dict("records")

    # Column info
    columns = []
    for col in df.columns:
        dtype = detect_col_type(df[col]) if not pd.api.types.is_datetime64_any_dtype(df[col]) else "date"
        columns.append({
            "name": col,
            "type": dtype,
            "nulls": int(df[col].isna().sum()),
            "unique": int(df[col].nunique()),
        })

    # Stats numéricas
    metric_cols = get_metric_cols(df)
    stats = {}
    if metric_cols:
        desc = df[metric_cols].describe().replace({np.nan: None})
        stats = desc.to_dict()

    # Charts
    charts = build_chart_data(df)

    # AI insights
    summary = build_summary_for_ai(df)
    prompt = (
        "Eres un analista de datos senior. Basándote en este dataset, entrega:\n\n"
        "**Resumen ejecutivo** (2-3 oraciones con los hallazgos más importantes)\n\n"
        "**Insights clave:**\n"
        "- [3-5 puntos accionables y concretos]\n\n"
        "**Recomendación principal** (qué acción concreta se debería tomar)\n\n"
        "Responde en español. Sé directo y específico con los números del dataset.\n\n"
        f"{summary}"
    )

    for model_name in ["gemini-2.0-flash-lite", "gemini-1.5-flash", "gemini-2.0-flash"]:
        try:
            response = client.models.generate_content(model=model_name, contents=prompt)
            ai_insights = response.text
            break
        except Exception:
            ai_insights = None

    if not ai_insights:
        ai_insights = generate_local_insights(df)

    return {
        "filename": file.filename,
        "rows": len(df),
        "cols": len(df.columns),
        "preview": preview,
        "columns": columns,
        "stats": stats,
        "charts": charts,
        "ai_insights": ai_insights,
    }


@app.get("/health")
def health():
    return {"status": "ok"}
