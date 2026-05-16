# DataAnalytic IA

Herramienta de análisis de datos CSV con inteligencia artificial. Sube cualquier archivo CSV y obtén gráficas automáticas, estadísticas y un informe generado por **Google Gemini** en segundos.

![Demo](https://raw.githubusercontent.com/camilocal017/data-analytic-ia/main/docs/preview.png)

## Demo

🔗 [data-analytic-ia.vercel.app](https://data-analytic-ia.vercel.app)

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 18, Recharts, Tailwind CSS v4, Vite |
| Backend | FastAPI, Pandas, NumPy |
| IA | Google Gemini 2.0 Flash (API) |
| Deploy | Vercel (frontend) · Railway (backend) |

## Funcionalidades

- **Carga inteligente** — drag & drop o selector de archivos, auto-detección de separador (`,` `;` `\t`)
- **Limpieza automática** — parsea fechas en español (`a. m.` / `p. m.`), descarta columnas ID sin valor analítico
- **4 visualizaciones** — barra, línea temporal, histograma y pie chart generados automáticamente
- **Insights con IA** — resumen ejecutivo + puntos accionables vía Google Gemini
- **Fallback local** — si Gemini no está disponible, genera estadísticas descriptivas sin API
- **Preview de datos** — tabla con tipos de columna, valores únicos y campos nulos

## Estructura

```
data-analytic-ia/
├── backend/
│   ├── main.py          # FastAPI · análisis + integración Gemini
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── App.jsx      # UI principal (upload, charts, insights)
    │   └── index.css
    └── vite.config.js
```

## Instalación local

### Backend

```bash
cd backend
python -m venv venv
.\venv\Scripts\activate          # Windows
pip install -r requirements.txt

# Crear archivo .env con tu API key de Gemini
echo GEMINI_API_KEY=tu_clave_aqui > .env

uvicorn main:app --port 8001 --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Abrir `http://localhost:5173`

## Variables de entorno

| Variable | Dónde | Descripción |
|---|---|---|
| `GEMINI_API_KEY` | `backend/.env` | API key de Google AI Studio |
| `VITE_API_URL` | `frontend/.env.local` | URL del backend (vacío = proxy local) |

## Cómo conseguir la API key

1. Entrar a [aistudio.google.com](https://aistudio.google.com)
2. **Get API key** → crear clave gratuita
3. Pegar en `backend/.env`

---

Desarrollado por **Camilo Calderón** · [GitHub](https://github.com/camilocal017) · [Portfolio](https://camilocalderon.dev)
