export default function UnknownSubdomainPage() {
    return (
        <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            fontFamily: "system-ui, sans-serif",
            background: "#0f172a",
            color: "#f8fafc",
            gap: "16px",
        }}>
            <h1 style={{ fontSize: "6rem", fontWeight: 700, margin: 0, color: "#7c3aed" }}>404</h1>
            <h2 style={{ fontSize: "1.5rem", fontWeight: 600, margin: 0 }}>Tenant Not Found</h2>
            <p style={{ color: "#94a3b8", textAlign: "center", maxWidth: 400, margin: 0 }}>
                The subdomain you are trying to access does not exist or has not been registered.
            </p>
        </div>
    );
}
