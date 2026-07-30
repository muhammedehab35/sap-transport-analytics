import './Dashboard.css'

// Lien d'intégration sécurisée Power BI (nécessite d'être connecté avec un compte
// ayant accès au rapport — ne s'affichera pas pour un visiteur anonyme du site).
const POWERBI_EMBED_URL =
  'https://app.powerbi.com/reportEmbed?reportId=535feabf-fec4-4892-aacb-c8f7bb387aa2&autoAuth=true&ctid=604f1a96-cbe8-43f8-abbf-f8eaf5d85730'

function Dashboard() {
  return (
    <section>
      <h2>Dashboard interactif</h2>
      <p className="subtitle">
        Vue temps réel des transports, risques et indicateurs de performance.
      </p>

      <div className="notice">
        Ce dashboard utilise un lien d'intégration sécurisée Power BI : il ne s'affiche
        correctement que pour une personne connectée avec un compte ayant accès au rapport
        (pas pour un visiteur anonyme).
      </div>

      <div className="dashboard-frame-wrap">
        <iframe title="h01" src={POWERBI_EMBED_URL} allowFullScreen />
      </div>
    </section>
  )
}

export default Dashboard
