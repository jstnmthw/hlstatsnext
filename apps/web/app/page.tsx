import { Header } from "@/features/common/header"
import { Footer } from "@/features/common/footer"
import { MainContent } from "@/features/common/main-content"
import { Layout } from "@/features/common/layout"

export default function Page() {
  return (
    <Layout>
      <Header />
      <MainContent>
        <div className="p-6">
          <h1 className="text-3xl font-bold mb-4">Sticky Footer Demo</h1>
          <p className="mb-4">
            This layout demonstrates the classic sticky footer pattern. The footer will stick to the
            bottom of the viewport when there&apos;s not enough content to fill the screen.
          </p>
          <p className="mb-4">
            Try adding more content or resizing your browser window to see how it behaves.
          </p>
        </div>
      </MainContent>
      <Footer />
    </Layout>
  )
}
