export interface AdminPageProps {
  searchParams: Promise<{
    page?: string
    pageSize?: string
    sortField?: string
    sortOrder?: string
    search?: string
    [key: string]: string | undefined
  }>
}
