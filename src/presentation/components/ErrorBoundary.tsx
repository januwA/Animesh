import { AlertTriangle } from "lucide-react";
import type { ErrorInfo, ReactNode } from "react";
import { Component } from "react";

interface Props {
	children: ReactNode;
}

interface State {
	hasError: boolean;
	error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
	public override state: State = {
		hasError: false,
		error: null,
	};

	public static getDerivedStateFromError(error: Error): State {
		return { hasError: true, error };
	}

	public override componentDidCatch(_error: Error, _errorInfo: ErrorInfo) {
		// Log fatal crashes if needed, but respect error propagation rules.
	}

	public override render() {
		if (this.state.hasError) {
			return (
				<div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 text-center select-none">
					<div className="max-w-md w-full bg-card border border-border p-8 rounded-2xl shadow-xl space-y-6 backdrop-blur-md animate-in fade-in duration-300">
						<div className="flex justify-center">
							<AlertTriangle className="h-12 w-12 text-destructive animate-pulse" />
						</div>
						<div className="space-y-2">
							<h2 className="text-xl font-bold tracking-tight">
								应用遇到致命错误
							</h2>
							<p className="text-xs text-muted-foreground leading-relaxed break-all font-mono">
								{this.state.error?.message ||
									/* v8 ignore next */
									"程序发生未知异常，请重新启动或刷新"}
							</p>
						</div>
						<button
							type="button"
							onClick={() => window.location.reload()}
							className="w-full inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-primary text-primary-foreground hover:bg-primary/90 h-10 text-sm font-semibold shadow-md active:translate-y-px transition-all cursor-pointer"
						>
							重新加载应用
						</button>
					</div>
				</div>
			);
		}

		return this.props.children;
	}
}
