import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { I18nProvider } from "./i18n";
import { GlossaryProvider } from "./components/Glossary";
import { CustomFigureHost } from "./components/CustomFigureHost";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nProvider>
      <GlossaryProvider>
        <CustomFigureHost>
          <App />
        </CustomFigureHost>
      </GlossaryProvider>
    </I18nProvider>
  </StrictMode>,
);
