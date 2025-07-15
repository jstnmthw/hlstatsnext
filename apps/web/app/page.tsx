import { Header } from "@/features/common/header"
import { Footer } from "@/features/common/footer"
import { MainContent } from "@/features/common/main-content"

export default function Page() {
  return (
    <>
      <Header />
      <MainContent>
        <h1>Hello World</h1>
      </MainContent>
      <Footer />
    </>
  )
}
