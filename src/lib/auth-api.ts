import { makeFunctionReference } from "convex/server"
import type { ConvexAuthApi, RefreshResult } from "@convex-dev/auth"
import type { SignInResult, SignUpResult } from "@convex-dev/auth/methods/username-password/server"
type ClientView<T> = T extends { tokens: unknown } ? Omit<T, "tokens"> & { tokens: { accessToken: string; userId: string } } : T

export const authApi: ConvexAuthApi & {
  signInWithUsernamePassword: ReturnType<typeof makeFunctionReference<"mutation", { username: string; password: string }, ClientView<SignInResult>>>
  signUpWithUsernamePassword: ReturnType<typeof makeFunctionReference<"mutation", { username: string; password: string }, ClientView<SignUpResult>>>
} = {
  refreshSession: makeFunctionReference<"mutation", { refreshToken: string }, RefreshResult>("auth:refreshSession"),
  signOut: makeFunctionReference<"mutation", { refreshToken: string }, null>("auth:signOut"),
  isAuthenticated: makeFunctionReference<"query", Record<string, never>, boolean>("auth:isAuthenticated"),
  signInWithUsernamePassword: makeFunctionReference<"mutation", { username: string; password: string }, ClientView<SignInResult>>("auth:signInWithUsernamePassword"),
  signUpWithUsernamePassword: makeFunctionReference<"mutation", { username: string; password: string }, ClientView<SignUpResult>>("auth:signUpWithUsernamePassword"),
}
