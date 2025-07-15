export function Header() {
  return (
    <header className="w-full">
      <div>{process.env.NEXT_PUBLIC_APP_NAME}</div>
    </header>
  )
}
