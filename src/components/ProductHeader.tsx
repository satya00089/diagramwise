import { useState, type FC, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { HiBars2, HiXMark } from "react-icons/hi2";
import RollingNavLabel from "./RollingNavLabel";

type ProductHeaderProps = {
  actions?: ReactNode;
};

const navItems = [
  { label: "Practice problems", to: "/problems/" },
  { label: "Design Studio", to: "/playground/free" },
  { label: "Learning paths", to: "/learning-paths/" },
] as const;

const isActivePath = (pathname: string, to: string) => {
  if (to === "/#how-it-works") return pathname === "/";
  return pathname.startsWith(to.replace(/\/$/, ""));
};

const ProductHeader: FC<ProductHeaderProps> = ({ actions }) => {
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="product-header">
      <div className="product-header__inner">
        <Link
          className="product-header__brand"
          to="/"
          aria-label="Diagramwise home"
        >
          <img src="/logo-64.png" alt="" aria-hidden="true" />
          <span>Diagramwise</span>
        </Link>

        <nav className="product-header__nav" aria-label="Main navigation">
          {navItems.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              aria-label={item.label}
              aria-current={
                isActivePath(pathname, item.to) ? "page" : undefined
              }
            >
              <RollingNavLabel>{item.label}</RollingNavLabel>
            </Link>
          ))}
        </nav>

        <div className="product-header__actions">
          {actions}
          <button
            type="button"
            className="product-header__menu-toggle"
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={menuOpen}
            aria-controls="product-mobile-nav"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <HiXMark /> : <HiBars2 />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav
          id="product-mobile-nav"
          className="product-header__mobile-nav"
          aria-label="Mobile navigation"
        >
          {navItems.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              onClick={() => setMenuOpen(false)}
              aria-current={
                isActivePath(pathname, item.to) ? "page" : undefined
              }
            >
              {item.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
};

export default ProductHeader;
