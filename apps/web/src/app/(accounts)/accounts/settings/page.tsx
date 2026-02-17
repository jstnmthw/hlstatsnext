import { PasswordForm } from "@/features/accounts/components/password-form"
import { ProfileForm } from "@/features/accounts/components/profile-form"
import { Footer } from "@/features/common/components/footer"
import { Header } from "@/features/common/components/header"
import { MainContent } from "@/features/common/components/main-content"
import { PageWrapper } from "@/features/common/components/page-wrapper"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Account Settings - " + process.env.NEXT_PUBLIC_APP_NAME,
  description: "Manage your account settings and preferences.",
}

export default function AccountSettingsPage() {
  return (
    <PageWrapper>
      <Header />
      <MainContent className="container">
        <div className="mt-8 mb-8">
          <h1 className="text-2xl font-bold tracking-tight uppercase">Account Settings</h1>
          <p className="text-muted-foreground">Manage your account settings and preferences.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card className="col-span-full self-start md:col-span-2">
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>Update your personal account information.</CardDescription>
            </CardHeader>
            <CardContent>
              <ProfileForm />
            </CardContent>
          </Card>
          <div className="col-span-full flex flex-col gap-4 md:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Change Password</CardTitle>
                <CardDescription>Update your password to keep your account secure.</CardDescription>
              </CardHeader>
              <CardContent>
                <PasswordForm />
              </CardContent>
            </Card>
          </div>
        </div>
      </MainContent>
      <Footer />
    </PageWrapper>
  )
}
