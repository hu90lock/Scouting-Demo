import type { ButtonHTMLAttributes } from "react"
import { Button as BaseButton } from "@base-ui/react/button"
import { cn } from "@/lib/utils"

export function Button({ className, variant = "default", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "secondary" | "ghost" }) { return <BaseButton className={cn("btn", variant === "default" && "btn-primary", variant === "secondary" && "btn-secondary", variant === "ghost" && "btn-ghost", className)} {...props} /> }
