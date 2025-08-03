export function Footer() {
  return (
    <footer className="w-full mt-auto py-4 border-t border-border">
      <div className="max-w-screen-lg mx-auto">
        <div className="flex justify-between items-center">
          <div className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} {process.env.NEXT_PUBLIC_APP_NAME}. All rights
            reserved.
          </div>
        </div>
      </div>
    </footer>
  )
}
