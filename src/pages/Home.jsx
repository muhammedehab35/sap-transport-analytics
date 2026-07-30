import { Link } from 'react-router-dom'
import './Home.css'

const KPIS = [
  { value: '100', label: 'Transports analysés' },
  { value: '20%', label: "Taux d'échec d'import", warning: true },
  { value: '6.0', label: 'Délai moyen (jours)' },
  { value: '58', label: 'Transports à risque élevé', warning: true },
]

const PHASES = [
  {
    n: 1,
    title: 'Étude & Architecture',
    text: 'Compréhension du CTS, du landscape SAP et conception de l\'architecture cible.',
  },
  {
    n: 2,
    title: 'Extraction des données',
    text: 'Tables Z (ZTR_TRANSPORT, ZTR_OBJECTS, ZTR_KPI) et moteur d\'extraction du cycle de vie des transports.',
  },
  {
    n: 3,
    title: 'Classification des risques',
    text: "Score de risque par transport selon les objets modifiés (tables, autorisations, urgence...).",
  },
  {
    n: 4,
    title: 'KPI & Analytics',
    text: 'Agrégation mensuelle : volume, stabilité, délais, performance par développeur.',
  },
  {
    n: 5,
    title: 'Dashboard',
    text: 'Visualisation interactive Power BI : Overview, Risk Monitoring, Developer Analytics, Timeline.',
  },
  {
    n: 6,
    title: 'Alerting',
    text: "Notifications automatiques en cas de transport à risque, d'échec ou de blocage prolongé.",
  },
]

const TABLES = [
  {
    name: 'ZTR_TRANSPORT',
    items: [
      'Numéro de transport, propriétaire',
      "Dates de création et d'import (DEV / QA / PRD)",
      'Statut, délai, score et niveau de risque',
    ],
  },
  {
    name: 'ZTR_OBJECTS',
    items: [
      'Objets contenus dans chaque transport',
      "Type d'objet (table, programme, autorisation...)",
      'Niveau et score de risque par objet',
    ],
  },
  {
    name: 'ZTR_KPI',
    items: ['Agrégats mensuels', "Nombre de transports, taux d'échec", 'Délai moyen par période'],
  },
]

function Home() {
  return (
    <>
      <section className="hero">
        <h1>SAP Transport Management Analytics</h1>
        <p>
          Plateforme de monitoring et d'analyse de risques des transports SAP : suivi du cycle
          de vie DEV → QA → PRD, détection des échecs, classification des risques et pilotage
          par indicateurs clés.
        </p>
        <Link to="/dashboard" className="btn">
          Voir le Dashboard
        </Link>
        <a href="#architecture" className="btn secondary">
          Découvrir le projet
        </a>
      </section>

      <section>
        <h2>Aperçu des données</h2>
        <p className="subtitle">Chiffres clés extraits du jeu de données actuel</p>
        <div className="kpi-grid">
          {KPIS.map((kpi) => (
            <div className={`kpi-card${kpi.warning ? ' warning' : ''}`} key={kpi.label}>
              <div className="value">{kpi.value}</div>
              <div className="label">{kpi.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="architecture">
        <h2>Objectif du projet</h2>
        <p className="subtitle">
          Le projet couvre 6 phases, de l'étude du CTS SAP jusqu'à l'automatisation des alertes.
        </p>
        <div className="phase-grid">
          {PHASES.map((phase) => (
            <div className="phase-card" key={phase.n}>
              <span className="num">{phase.n}</span>
              <h3>{phase.title}</h3>
              <p>{phase.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2>Structure des données</h2>
        <p className="subtitle">Trois tables analytiques alimentent le dashboard</p>
        <div className="tables">
          {TABLES.map((table) => (
            <div className="table-card" key={table.name}>
              <h4>{table.name}</h4>
              <ul>
                {table.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}

export default Home
