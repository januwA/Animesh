import { Background } from "ajanuw-context";
import ReactDOM from "react-dom/client";
import { createHashRouter } from "react-router-dom";
import { createDIContainer } from "./di/DIContext";
import { LogLevel } from "./domain/logger/logger";
import { FetchHttpClient } from "./infrastructure/http/HttpClient";
import { ConsoleLogger } from "./infrastructure/logger/ConsoleLogger";
import { IndexedDbCacheStore } from "./infrastructure/storage/IndexedDbCacheStore";
import App from "./presentation/App";
import {
  applyAccent,
  getStoredAccent,
} from "./presentation/hooks/useAccentTheme";
import { routes } from "./presentation/routes";

applyAccent(getStoredAccent());

const router = createHashRouter(routes);

const logger = new ConsoleLogger(
  "App",
  import.meta.env.DEV ? LogLevel.DEBUG : LogLevel.ERROR,
);

const cacheStore = new IndexedDbCacheStore(logger);
cacheStore.clearExpired(Background).catch(() => {});

const httpClient = new FetchHttpClient(undefined, logger);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <App
    router={router}
    diContainer={createDIContainer({
      logger,
      cacheStore,
      httpClient,
    })}
  />,
);
