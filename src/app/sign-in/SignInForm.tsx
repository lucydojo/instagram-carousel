"use client";

import React, { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";

// --- TYPE DEFINITIONS ---

export interface Testimonial {
    avatarSrc: string;
    name: string;
    handle: string;
    text: string;
}

interface SignInPageProps {
    action: (formData: FormData) => Promise<void>;
    error?: string | null;
    canSetup?: boolean;
}

const DEMO_TESTIMONIALS: Testimonial[] = [
    {
        avatarSrc: "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix",
        name: "Alexandre",
        handle: "@alexandre",
        text: "This tool totally revolutionized how we create carousels for our clients.",
    },
    {
        avatarSrc: "https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka",
        name: "Sarah M.",
        handle: "@sarah_designs",
        text: "The glassmorphic UI is stunning and the AI generation is spot on.",
    },
];

// --- SUB-COMPONENTS ---

const GlassInputWrapper = ({ children }: { children: React.ReactNode }) => (
    <div className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-sm transition-colors focus-within:border-primary/50 focus-within:bg-primary/5">
        {children}
    </div>
);

const TestimonialCard = ({
    testimonial,
    delay,
}: {
    testimonial: Testimonial;
    delay: string;
}) => (
    <div
        className={`animate-testimonial ${delay} flex w-64 items-start gap-3 rounded-3xl border border-white/10 bg-card/40 p-5 backdrop-blur-xl dark:bg-zinc-800/40`}
    >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
            src={testimonial.avatarSrc}
            className="h-10 w-10 rounded-2xl object-cover"
            alt="avatar"
        />
        <div className="text-sm leading-snug">
            <p className="flex items-center gap-1 font-medium">{testimonial.name}</p>
            <p className="text-muted-foreground">{testimonial.handle}</p>
            <p className="mt-1 text-foreground/80">{testimonial.text}</p>
        </div>
    </div>
);

// --- MAIN COMPONENT ---

export const SignInForm: React.FC<SignInPageProps> = ({
    action,
    error,
    canSetup,
}) => {
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = () => {
        // We let the form submit natively to the server action, but we set loading state
        // Note: In Next.js Server Actions with <form action>, this onSubmit runs before the action.
        // However, to truly track pending state we should use useFormStatus, but to keep it simple with
        // the provided code structure, we just set loading here.
        setIsLoading(true);
    };

    return (
        <div className="flex h-[100dvh] w-[100dvw] flex-col font-geist md:flex-row">
            {/* Left column: sign-in form */}
            <section className="flex flex-1 items-center justify-center p-8">
                <div className="w-full max-w-md">
                    <div className="flex flex-col gap-6">
                        <h1 className="animate-element animate-delay-100 text-4xl font-semibold leading-tight md:text-5xl">
                            <span className="tracking-tighter text-foreground font-light">
                                Welcome back
                            </span>
                        </h1>
                        <p className="animate-element animate-delay-200 text-muted-foreground">
                            Enter your credentials to access your workspace.
                        </p>

                        {error && (
                            <div className="animate-element animate-delay-200 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                                {error}
                            </div>
                        )}

                        <form
                            className="space-y-5"
                            action={action}
                            onSubmit={handleSubmit}
                        >
                            <div className="animate-element animate-delay-300">
                                <label className="text-sm font-medium text-muted-foreground">
                                    Email Address
                                </label>
                                <GlassInputWrapper>
                                    <input
                                        name="email"
                                        type="email"
                                        placeholder="Enter your email address"
                                        required
                                        className="w-full rounded-2xl bg-transparent p-4 text-sm focus:outline-none"
                                    />
                                </GlassInputWrapper>
                            </div>

                            <div className="animate-element animate-delay-400">
                                <label className="text-sm font-medium text-muted-foreground">
                                    Password
                                </label>
                                <GlassInputWrapper>
                                    <div className="relative">
                                        <input
                                            name="password"
                                            type={showPassword ? "text" : "password"}
                                            placeholder="Enter your password"
                                            required
                                            className="w-full rounded-2xl bg-transparent p-4 pr-12 text-sm focus:outline-none"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute inset-y-0 right-3 flex items-center"
                                        >
                                            {showPassword ? (
                                                <EyeOff className="h-5 w-5 text-muted-foreground transition-colors hover:text-foreground" />
                                            ) : (
                                                <Eye className="h-5 w-5 text-muted-foreground transition-colors hover:text-foreground" />
                                            )}
                                        </button>
                                    </div>
                                </GlassInputWrapper>
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="animate-element animate-delay-600 w-full rounded-2xl bg-primary py-4 font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                            >
                                {isLoading ? (
                                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                                ) : (
                                    "Sign In"
                                )}
                            </button>
                        </form>
                        {canSetup ? (
                            <p className="animate-element animate-delay-700 text-center text-sm text-muted-foreground">
                                First time here?{" "}
                                <a
                                    href="/setup"
                                    className="text-primary transition-colors hover:underline"
                                >
                                    Run setup wizard
                                </a>
                            </p>
                        ) : null}
                    </div>
                </div>
            </section>

            {/* Right column: hero image + testimonials */}
            <section className="relative hidden flex-1 p-4 md:block">
                <div
                    className="animate-slide-right animate-delay-300 absolute inset-4 rounded-3xl bg-cover bg-center"
                    style={{
                        backgroundImage:
                            "url(https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop)",
                    }}
                >
                    <div className="absolute inset-0 rounded-3xl bg-black/20" />
                </div>
                <div className="absolute bottom-12 left-1/2 flex w-full -translate-x-1/2 justify-center gap-4 px-8">
                    <TestimonialCard
                        testimonial={DEMO_TESTIMONIALS[0]}
                        delay="animate-delay-1000"
                    />
                    <div className="hidden xl:flex">
                        <TestimonialCard
                            testimonial={DEMO_TESTIMONIALS[1]}
                            delay="animate-delay-1200"
                        />
                    </div>
                </div>
            </section>
        </div>
    );
};
