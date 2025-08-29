export interface AdminPageProps {
  searchParams: Promise<{
    page?: string
    sortField?: string
    sortOrder?: string
    search?: string
  }>
}
