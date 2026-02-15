export function Footer() {
  return (
    <footer className="mt-auto w-full py-4 text-xs">
      <div className="container">
        <div className="flex items-center justify-center">
          <div className="text-muted-foreground/80">
            &copy; {new Date().getFullYear()} {process.env.NEXT_PUBLIC_APP_NAME}. All rights
            reserved.
          </div>
        </div>
      </div>
    </footer>
  )
}
