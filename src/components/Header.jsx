import { NavLink } from 'react-router-dom'
import './Header.css'

function Header() {
  return (
    <header className="site-header">
      <div className="logo">
        SAP Transport <span>Analytics</span>
      </div>
      <nav>
        <NavLink to="/" end>
          Accueil
        </NavLink>
        <NavLink to="/dashboard">Dashboard</NavLink>
      </nav>
    </header>
  )
}

export default Header
