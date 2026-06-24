import { ReactNode } from 'react';
import shared from '../../styles/settings-shared.module.css';

interface SettingsPageLayoutProps {
  title: string;
  description: string;
  ariaLabel: string;
  children: ReactNode;
  footer?: ReactNode;
}

export const SettingsPageLayout: React.FC<SettingsPageLayoutProps> = ({
  title,
  description,
  ariaLabel,
  children,
  footer,
}) => {
  return (
    <div className={shared.page} role="main" aria-label={ariaLabel}>
      <header className={shared.header}>
        <h1 className={shared.title}>{title}</h1>
        <p className={shared.description}>{description}</p>
      </header>
      {children}
      {footer && <footer className={shared.footer}>{footer}</footer>}
    </div>
  );
};

export const SettingsLoading: React.FC<{ message: string }> = ({ message }) => (
  <div className={shared.loading}>{message}</div>
);

export { shared as settingsStyles };

export default SettingsPageLayout;
