import { Link } from "react-router-dom";

/**
 * <Button variant="primary|secondary|soft|ghost|dark|light|outline-light|danger"
 *         size="sm|lg|xl" block loading icon={Icon} to="/path" href="..."/>
 */
export default function Button({
  variant = "primary",
  size,
  block,
  square,
  loading,
  icon: Icon,
  iconRight: IconRight,
  iconOnly,
  to,
  href,
  className = "",
  children,
  disabled,
  type = "button",
  ...rest
}) {
  const cls = [
    "btn",
    `btn--${variant}`,
    size && `btn--${size}`,
    block && "btn--block",
    square && "btn--square",
    iconOnly && "btn--icon",
    loading && "btn--loading",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const iconSize = size === "sm" ? 16 : size === "xl" ? 22 : 19;
  const content = (
    <>
      {loading ? <span className="btn__spinner" aria-hidden="true" /> : Icon && <Icon size={iconSize} weight="bold" aria-hidden="true" />}
      {children != null && <span className="btn__label">{children}</span>}
      {IconRight && !loading && <IconRight size={iconSize} weight="bold" aria-hidden="true" />}
    </>
  );

  if (to && !disabled) {
    return (
      <Link to={to} className={cls} {...rest}>
        {content}
      </Link>
    );
  }
  if (href && !disabled) {
    return (
      <a href={href} className={cls} {...rest}>
        {content}
      </a>
    );
  }
  return (
    <button type={type} className={cls} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {content}
    </button>
  );
}
