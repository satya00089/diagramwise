import { useEffect, useId, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { HiChevronDown } from "react-icons/hi2";
import { useAuth } from "../hooks/useAuth";
import UserAvatar from "./UserAvatar";

type AccountMenuProps = {
  variant?: "default" | "inverse" | "landing";
};

const AccountMenu = ({ variant = "default" }: AccountMenuProps) => {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const accountName = user?.name?.trim() || user?.email || "Account";
  useEffect(() => {
    if (!open) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const closeOnOutsideFocus = (event: FocusEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("focusin", closeOnOutsideFocus);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("focusin", closeOnOutsideFocus);
    };
  }, [open]);

  if (isLoading || !isAuthenticated || !user) return null;

  return (
    <div className={`account-menu account-menu--${variant}`} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="account-menu__trigger"
        aria-label={`Account: ${accountName}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="account-menu__avatar-frame" aria-hidden="true">
          <UserAvatar
            userId={user.id}
            picture={user.picture}
            avatarKey={user.avatarKey}
            size={56}
            className="account-menu__avatar"
            animate="always"
          />
        </span>
        <span className="account-menu__name">{accountName}</span>
        <HiChevronDown
          className={`account-menu__chevron${open ? " account-menu__chevron--open" : ""}`}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div
          className="account-menu__panel"
          id={panelId}
          aria-label="Account options"
        >
          <div className="account-menu__identity">
            <strong>{accountName}</strong>
            {user.email && <span>{user.email}</span>}
          </div>
          <Link
            className={`account-menu__item${pathname === "/profile" ? " account-menu__item--current" : ""}`}
            to="/profile"
            aria-current={pathname === "/profile" ? "page" : undefined}
            onClick={() => setOpen(false)}
          >
            Your profile
          </Link>
          <button
            className="account-menu__item account-menu__item--sign-out"
            type="button"
            onClick={() => {
              setOpen(false);
              logout();
              navigate("/");
            }}
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
};

export default AccountMenu;
