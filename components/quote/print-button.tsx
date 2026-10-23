"use client";

export function PrintButton() {
  return (
    <button className="btn btn-ghost" onClick={() => window.print()}>
      Enregistrer en PDF
    </button>
  );
}
