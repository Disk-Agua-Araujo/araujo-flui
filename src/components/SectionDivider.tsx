export function SectionDivider() {
  return (
    <div className="flex justify-center py-3">
      <div
        className="h-[2px] rounded-full"
        style={{
          width: "70%",
          background:
            "linear-gradient(90deg, transparent 0%, hsl(var(--accent)) 30%, hsl(var(--accent)) 70%, transparent 100%)",
          opacity: 0.45,
        }}
      />
    </div>
  );
}
