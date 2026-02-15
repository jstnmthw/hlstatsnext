export function Footer() {
  return (
    <footer className="w-full mt-auto py-4">
      <div className="container">
        <div className="flex items-center">
          <div className="text-sm text-muted-foreground/80">
            &copy; {new Date().getFullYear()} {process.env.NEXT_PUBLIC_APP_NAME}. All rights
            reserved.
          </div>
        </div>
      </div>
    </footer>
  )
}
