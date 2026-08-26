import { createContext, use } from "react";
import { toast } from "sonner";
import { useDI } from "@/di/DIContext";
import { useQuery } from "@/presentation/hooks/useQuery";
import { formatError } from "@/utils";

export interface StreamServerContextType {
  streamPort: number | null;
}

export const StreamServerContext = createContext<
  StreamServerContextType | undefined
>(undefined);

export function StreamServerProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { getStreamPortUseCase } = useDI();

  const { data: streamPort } = useQuery(
    () => getStreamPortUseCase.execute(),
    [getStreamPortUseCase],
    {
      onError: (err) => {
        toast.error(`获取流媒体端口失败: ${formatError(err)}`);
      },
    },
  );

  return (
    <StreamServerContext value={{ streamPort }}>{children}</StreamServerContext>
  );
}

export function useStreamServer(): StreamServerContextType {
  const context = use(StreamServerContext);
  if (context === undefined) {
    throw new Error(
      "StreamServerContext was not provided. Make sure to wrap components with <StreamServerProvider>",
    );
  }
  return context;
}
