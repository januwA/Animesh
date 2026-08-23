import { createContext, use, useEffect, useState } from "react";
import { toast } from "sonner";
import { useDI } from "@/di/DIContext";
import { formatError } from "@/utils";

interface StreamServerContextType {
  streamPort: number | null;
}

const StreamServerContext = createContext<StreamServerContextType | undefined>(
  undefined,
);

export function StreamServerProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { getStreamPortUseCase } = useDI();
  const [streamPort, setStreamPort] = useState<number | null>(null);

  useEffect(() => {
    getStreamPortUseCase
      .execute()
      .then((port) => {
        setStreamPort(port);
      })
      .catch((err: unknown) => {
        toast.error(`获取流媒体端口失败: ${formatError(err)}`);
      });
  }, [getStreamPortUseCase]);

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
