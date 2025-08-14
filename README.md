# 📊 DataViz AI - Intelligent Data Visualization Platform

An advanced data visualization platform powered by AI that transforms raw data into beautiful, interactive dashboards with intelligent insights and automated analysis.

![DataViz AI](https://img.shields.io/badge/React-19.1.1-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-4.9.5-blue) ![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4.17-blue) ![Gemini AI](https://img.shields.io/badge/Gemini-AI-green)

## ✨ Features

### 🤖 AI-Powered Analysis
- **Smart Data Insights**: Automated pattern recognition and trend analysis
- **Intelligent Visualizations**: AI suggests the best chart types for your data
- **Natural Language Queries**: Ask questions about your data in plain English
- **Automated Reports**: Generate comprehensive analysis reports with AI

### 📈 Advanced Visualizations
- **Interactive Charts**: Bar, Line, Pie, Scatter plots with Recharts
- **Geographic Maps**: Interactive maps with Leaflet and React-Leaflet
- **Real-time Updates**: Dynamic data refresh and live visualizations
- **Custom Themes**: Multiple color schemes and styling options

### 🛠️ Data Management
- **Multi-format Support**: CSV, Excel, JSON data import
- **CKAN Integration**: Connect to open data repositories
- **Data Profiling**: Automatic data quality assessment
- **Filter & Search**: Advanced filtering and search capabilities

### 💼 Export & Sharing
- **PNG Export**: High-quality dashboard exports
- **PDF Reports**: Professional AI analysis reports
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Cloud Ready**: Optimized for deployment on Vercel

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ 
- npm or yarn
- Gemini API key (for AI features)

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd data-visualizer
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Add your Gemini API key to `.env`:
   ```
   GEMINI_KEY=your_gemini_api_key_here
   ```

4. **Start development server**
   ```bash
   npm start
   ```

5. **Open your browser**
   Navigate to `http://localhost:3000`

## 🔧 Available Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Starts the development server |
| `npm run build` | Creates production build |
| `npm test` | Runs test suite |
| `npm run preview` | Preview production build locally |
| `npm run analyze` | Build and analyze bundle size |

## 🌐 Deployment on Vercel

### Automatic Deployment

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push origin main
   ```

2. **Connect to Vercel**
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Click "New Project"
   - Import your GitHub repository
   - Vercel will auto-detect React and configure build settings

3. **Set Environment Variables**
   In Vercel dashboard:
   - Go to Project Settings > Environment Variables
   - Add: `GEMINI_KEY` with your API key
   - Set for Production, Preview, and Development

4. **Deploy**
   - Vercel will automatically build and deploy
   - Your app will be live at `https://your-project-name.vercel.app`

### Manual Deployment

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Follow the prompts to configure your deployment
```

## 🏗️ Project Structure

```
data-visualizer/
├── public/                 # Static assets
├── src/
│   ├── components/        # React components
│   │   ├── charts/       # Chart components
│   │   ├── inputs/       # Form inputs
│   │   └── layout/       # Layout components
│   ├── services/         # API services
│   ├── types/            # TypeScript definitions
│   ├── utils/            # Utility functions
│   └── App.tsx           # Main app component
├── build/                # Production build
├── vercel.json          # Vercel configuration
└── package.json         # Dependencies
```

## 🎨 Customization

### Themes
The app supports multiple themes. Modify `src/utils/theme.ts` to add custom color schemes.

### Charts
Add new chart types in `src/components/charts/` and extend the chart selection logic.

### AI Integration
Customize AI prompts and responses in `src/services/geminiApi.ts`.

## 🔒 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GEMINI_KEY` | Google Gemini API key for AI features | Yes |

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS
- **Charts**: Recharts, React-Leaflet
- **AI**: Google Gemini API
- **Build**: Create React App, Vercel
- **Styling**: Tailwind CSS, Framer Motion
- **State**: React Hooks, Context API

## 🙏 Acknowledgments

- Google Gemini AI for intelligent analysis
- Recharts for beautiful charts
- React community for amazing ecosystem
- Vercel for seamless deployment

---

**Made with ❤️ by YOUNESS**

*Transform your data into insights with the power of AI!*