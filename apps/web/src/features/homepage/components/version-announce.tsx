import {
  Badge,
  Button,
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  IconDownload,
} from "@repo/ui"
import Image from "next/image"

export function VersionAnnounce() {
  return (
    <Card className="relative w-full max-w-sm overflow-hidden">
      <div className="relative px-6">
        <div className="absolute inset-0 z-30" />
        <Image
          width={768}
          height={432}
          src="https://images.unsplash.com/photo-1607853827120-6847830b38b0?w=768&auto=format&q=80"
          alt="Photo by @martinkatler on Unsplash"
          title="Photo by @martinkatler on Unsplash"
          className="relative z-20 aspect-video w-full rounded-md object-cover object-[center_80%]"
        />
      </div>
      <CardHeader>
        <CardTitle>HLStatsNext v0.1.0</CardTitle>
        <CardDescription>
          Real-time player rankings, stats tracking, and server monitoring for Source and GoldSrc
          game servers.
        </CardDescription>
      </CardHeader>
      <CardFooter>
        <Badge variant="outline">v0.1.0</Badge>
        <Button className="ml-auto">
          Download <IconDownload data-icon="inline-end" />
        </Button>
      </CardFooter>
    </Card>
  )
}
