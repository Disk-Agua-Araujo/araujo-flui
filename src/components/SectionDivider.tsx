export function SectionDivider() {
  return (
    <div className="container py-1">
      <div
        className="h-[2px] w-full rounded-full"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, hsl(var(--accent)) 30%, hsl(var(--accent)) 70%, transparent 100%)",
          opacity: 0.45,
        }}
      />
    </div>
  );
}
