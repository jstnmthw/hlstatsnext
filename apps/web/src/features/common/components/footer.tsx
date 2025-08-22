export function Footer() {
  return (
    <footer className="w-full mt-auto py-4 border-t border-border">
      <div className="container">
        <div className="flex justify-between items-center">
          <div className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} {process.env.NEXT_PUBLIC_APP_NAME}. All rights
            reserved.
          </div>
        </div>
      </div>
    </footer>
  )
}
