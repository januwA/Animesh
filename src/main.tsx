import React from "react";
import ReactDOM from "react-dom/client";
import { createHashRouter } from "react-router-dom";
import App from "./App";
import { createDefaultDIContainer } from "./di/DIContext";
import { routes } from "./routes";

const router = createHashRouter(routes);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
	<React.StrictMode>
		<App router={router} diContainer={createDefaultDIContainer()} />
	</React.StrictMode>,
);
