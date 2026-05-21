import type { AuthPayload } from '../config/auth';

export type AppEnv = {
  Variables: {
    user: AuthPayload;
    requestId: string;
  };
};
