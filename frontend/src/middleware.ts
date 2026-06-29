import { defineMiddleware } from "astro:middleware";

export const onRequest = defineMiddleware((context, next) => {
  const url = new URL(context.request.url);
  const pathname = url.pathname.endsWith("/") && url.pathname.length > 1 
    ? url.pathname.slice(0, -1) 
    : url.pathname;
    
  console.log("Middleware running for:", url.pathname);
  console.log("Cleaned pathname:", pathname);
  
  // Only check cookies on specific routes to avoid Astro warnings during static build
  const isAuthRoute = pathname === "/login" || pathname === "/register";
  const isProtectedRoute = pathname === "/dashboard" || pathname === "/checkout" || pathname.startsWith("/checkout/");

  console.log("isAuthRoute:", isAuthRoute, "isProtectedRoute:", isProtectedRoute);

  if (isAuthRoute || isProtectedRoute) {
    const auth = context.cookies.get("tuneboss-auth")?.boolean();
    console.log("Auth cookie:", auth);
    
    if (auth && isAuthRoute) {
      return context.redirect("/dashboard");
    } else if (!auth && isProtectedRoute) {
      return context.redirect("/login");
    }
  }
  
  return next();
});
