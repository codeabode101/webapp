export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="text-center p-4 text-muted border-t border-border">
      © Codeabode {year}
    </footer>
  );
}
