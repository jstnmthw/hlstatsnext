"use client"

import * as React from "react"
import { useState } from "react"

import { Example, ExampleWrapper } from "./example"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./alert-dialog"
import { Avatar, AvatarFallback, AvatarGroup, AvatarImage } from "./avatar"
import { Badge } from "./badge"
import { Button } from "./button"
import { ButtonGroup } from "./button-group"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./card"
import { Checkbox } from "./checkbox"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "./combobox"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "./dropdown-menu"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "./empty"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldTitle,
} from "./field"
import { Input } from "./input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
} from "./input-group"
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "./item"
import { Label } from "./label"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "./popover"
import { RadioGroup, RadioGroupItem } from "./radio-group"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select"
import { Separator } from "./separator"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./sheet"
import { Slider } from "./slider"
import { Spinner } from "./spinner"
import { Switch } from "./switch"
import { Textarea } from "./textarea"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip"
import {
  IconMinus,
  IconPlus,
  IconArrowLeft,
  IconChevronDown,
  IconMailCheck,
  IconArchive,
  IconClock,
  IconCalendarPlus,
  IconFilterPlus,
  IconTag,
  IconTrash,
  IconArrowRight,
  IconVolume,
  IconCheck,
  IconUserX,
  IconShare,
  IconCopy,
  IconAlertTriangle,
  IconRobot,
  IconSearch,
  IconInfoCircle,
  IconStar,
  IconWaveSine,
  IconArrowUp,
  IconBluetooth,
  IconDotsVertical,
  IconFile,
  IconFolder,
  IconFolderOpen,
  IconFileCode,
  IconDots,
  IconFolderSearch,
  IconDeviceFloppy,
  IconDownload,
  IconEye,
  IconLayout,
  IconPalette,
  IconSun,
  IconMoon,
  IconDeviceDesktop,
  IconHelpCircle,
  IconFileText,
  IconLogout,
  IconShoppingBag,
} from "@tabler/icons-react"

export function CoverExample() {
  return (
    <TooltipProvider>
      <ExampleWrapper>
        <ObservabilityCard />
        <SmallFormExample />
        <FormExample />
        <FieldExamples />
        <ItemExample />
        <ButtonGroupExamples />
        <EmptyAvatarGroup />
        <InputGroupExamples />
        <SheetExample />
        <BadgeExamples />
        <ButtonVariantExamples />
      </ExampleWrapper>
    </TooltipProvider>
  )
}

function ButtonVariantExamples() {
  return (
    <Example title="Buttons">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm">Primary</Button>
          <Button variant="secondary" size="sm">
            Secondary
          </Button>
          <Button variant="destructive" size="sm">
            Destructive
          </Button>
          <Button variant="outline" size="sm">
            Outline
          </Button>
          <Button variant="ghost" size="sm">
            Ghost
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button>
            <IconPlus /> Create
          </Button>
          <Button variant="secondary">
            <IconArrowLeft /> Back
          </Button>
          <Button variant="destructive">
            <IconTrash /> Delete
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="icon" aria-label="Add">
            <IconPlus />
          </Button>
          <Button variant="secondary" size="icon" aria-label="Search">
            <IconSearch />
          </Button>
          <Button variant="destructive" size="icon" aria-label="Delete">
            <IconTrash />
          </Button>
          <Button variant="outline" size="icon" aria-label="Copy">
            <IconCopy />
          </Button>
          <Button variant="ghost" size="icon" aria-label="More">
            <IconDots />
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button disabled>Disabled</Button>
          <Button variant="secondary" disabled>
            Disabled
          </Button>
          <Button variant="destructive" disabled>
            Disabled
          </Button>
        </div>
      </div>
    </Example>
  )
}

function FieldExamples() {
  const [gpuCount, setGpuCount] = React.useState(8)
  const [value, setValue] = useState([200, 800])
  const handleGpuAdjustment = React.useCallback((adjustment: number) => {
    setGpuCount((prevCount) => Math.max(1, Math.min(99, prevCount + adjustment)))
  }, [])

  const handleGpuInputChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10)
    if (!isNaN(value) && value >= 1 && value <= 99) {
      setGpuCount(value)
    }
  }, [])

  return (
    <Example title="Fields">
      <FieldSet className="w-full max-w-md">
        <FieldGroup>
          <FieldSet>
            <FieldLegend>Compute Environment</FieldLegend>
            <FieldDescription>Select the compute environment for your cluster.</FieldDescription>
            <RadioGroup defaultValue="kubernetes">
              <FieldLabel htmlFor="kubernetes-r2h">
                <Field orientation="horizontal">
                  <FieldContent>
                    <FieldTitle>Kubernetes</FieldTitle>
                    <FieldDescription>
                      Run GPU workloads on a K8s configured cluster. This is the default.
                    </FieldDescription>
                  </FieldContent>
                  <RadioGroupItem value="kubernetes" id="kubernetes-r2h" aria-label="Kubernetes" />
                </Field>
              </FieldLabel>
              <FieldLabel htmlFor="vm-z4k">
                <Field orientation="horizontal">
                  <FieldContent>
                    <FieldTitle>Virtual Machine</FieldTitle>
                    <FieldDescription>
                      Access a VM configured cluster to run workloads. (Coming soon)
                    </FieldDescription>
                  </FieldContent>
                  <RadioGroupItem value="vm" id="vm-z4k" aria-label="Virtual Machine" />
                </Field>
              </FieldLabel>
            </RadioGroup>
          </FieldSet>
          <FieldSeparator />
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor="number-of-gpus-f6l">Number of GPUs</FieldLabel>
              <FieldDescription>You can add more later.</FieldDescription>
            </FieldContent>
            <ButtonGroup>
              <Input
                id="number-of-gpus-f6l"
                value={gpuCount}
                onChange={handleGpuInputChange}
                size={3}
                maxLength={3}
              />
              <Button
                variant="outline"
                size="icon"
                type="button"
                aria-label="Decrement"
                onClick={() => handleGpuAdjustment(-1)}
                disabled={gpuCount <= 1}
              >
                <IconMinus />
              </Button>
              <Button
                variant="outline"
                size="icon"
                type="button"
                aria-label="Increment"
                onClick={() => handleGpuAdjustment(1)}
                disabled={gpuCount >= 99}
              >
                <IconPlus />
              </Button>
            </ButtonGroup>
          </Field>
          <FieldSeparator />
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor="tinting">Wallpaper Tinting</FieldLabel>
              <FieldDescription>Allow the wallpaper to be tinted.</FieldDescription>
            </FieldContent>
            <Switch id="tinting" defaultChecked />
          </Field>
          <FieldSeparator />
          <FieldLabel htmlFor="checkbox-demo">
            <Field orientation="horizontal">
              <Checkbox id="checkbox-demo" defaultChecked />
              <FieldLabel htmlFor="checkbox-demo" className="line-clamp-1">
                I agree to the terms and conditions
              </FieldLabel>
            </Field>
          </FieldLabel>
          <FieldSeparator />
          <Field>
            <FieldTitle>Price Range</FieldTitle>
            <FieldDescription>
              Set your budget range ($
              <span className="font-medium tabular-nums">{value[0]}</span> -{" "}
              <span className="font-medium tabular-nums">{value[1]}</span>).
            </FieldDescription>
            <Slider
              value={value}
              onValueChange={(val) => setValue(val as number[])}
              max={1000}
              min={0}
              step={10}
              className="mt-2 w-full"
              aria-label="Price Range"
            />
          </Field>
          <Field orientation="horizontal">
            <Button type="submit">Submit</Button>
            <Button variant="secondary" type="button">
              Cancel
            </Button>
          </Field>
        </FieldGroup>
      </FieldSet>
    </Example>
  )
}

function ButtonGroupExamples() {
  const [label, setLabel] = React.useState("personal")

  return (
    <Example title="Button Group" className="items-center justify-center">
      <div className="flex flex-col gap-6">
        <ButtonGroup>
          <ButtonGroup className="hidden sm:flex">
            <Button variant="outline" size="icon-sm" aria-label="Go Back">
              <IconArrowLeft />
            </Button>
          </ButtonGroup>
          <ButtonGroup>
            <Button variant="outline" size="sm">
              Archive
            </Button>
            <Button variant="outline" size="sm">
              Report
            </Button>
          </ButtonGroup>
          <ButtonGroup>
            <Button variant="outline" size="sm">
              Snooze
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon-sm" aria-label="More Options">
                  <IconChevronDown />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuGroup>
                  <DropdownMenuItem>
                    <IconMailCheck />
                    Mark as Read
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <IconArchive />
                    Archive
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem>
                    <IconClock />
                    Snooze
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <IconCalendarPlus />
                    Add to Calendar
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <IconFilterPlus />
                    Add to List
                  </DropdownMenuItem>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <IconTag />
                      Label As...
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      <DropdownMenuRadioGroup value={label} onValueChange={setLabel}>
                        <DropdownMenuRadioItem value="personal">Personal</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="work">Work</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="other">Other</DropdownMenuRadioItem>
                      </DropdownMenuRadioGroup>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem variant="destructive">
                    <IconTrash />
                    Trash
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </ButtonGroup>
          <ButtonGroup className="hidden sm:flex">
            <Button variant="outline" size="icon-sm" aria-label="Previous">
              <IconArrowLeft />
            </Button>
            <Button variant="outline" size="icon-sm" aria-label="Next">
              <IconArrowRight />
            </Button>
          </ButtonGroup>
        </ButtonGroup>
        <div className="flex gap-4">
          <ButtonGroup className="hidden sm:flex">
            <ButtonGroup>
              <Button variant="outline">1</Button>
              <Button variant="outline">2</Button>
              <Button variant="outline">3</Button>
            </ButtonGroup>
          </ButtonGroup>
          <ButtonGroup>
            <ButtonGroup>
              <Button variant="outline">Follow</Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    <IconChevronDown />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Quick Actions</DropdownMenuLabel>
                    <DropdownMenuItem>
                      <IconVolume />
                      Mute Conversation
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <IconCheck />
                      Mark as Read
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <IconUserX />
                      Block User
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Conversation</DropdownMenuLabel>
                    <DropdownMenuItem>
                      <IconShare />
                      Share Conversation
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <IconCopy />
                      Copy Conversation
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <IconAlertTriangle />
                      Report Conversation
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem variant="destructive">
                      <IconTrash />
                      Delete Conversation
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </ButtonGroup>
            <ButtonGroup>
              <Button variant="outline">
                <IconRobot /> Copilot
              </Button>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="Open Popover">
                    <IconChevronDown />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-96">
                  <PopoverHeader>
                    <PopoverTitle>Agent Tasks</PopoverTitle>
                    <PopoverDescription>
                      Describe your task in natural language. Copilot will work in the background
                      and open a pull request.
                    </PopoverDescription>
                  </PopoverHeader>
                  <div className="text-sm *:[p:not(:last-child)]:mb-2">
                    <Textarea
                      placeholder="Describe your task in natural language."
                      className="min-h-32 resize-none"
                    />
                  </div>
                </PopoverContent>
              </Popover>
            </ButtonGroup>
          </ButtonGroup>
        </div>
      </div>
    </Example>
  )
}

function InputGroupExamples() {
  const [isFavorite, setIsFavorite] = React.useState(false)
  const [voiceEnabled, setVoiceEnabled] = React.useState(false)

  return (
    <Example title="Input Group">
      <div className="flex flex-col gap-6">
        <InputGroup>
          <InputGroupInput placeholder="Search..." />
          <InputGroupAddon>
            <IconSearch />
          </InputGroupAddon>
          <InputGroupAddon align="inline-end">12 results</InputGroupAddon>
        </InputGroup>
        <InputGroup>
          <InputGroupInput placeholder="example.com" className="pl-1!" />
          <InputGroupAddon>
            <InputGroupText>https://</InputGroupText>
          </InputGroupAddon>
          <InputGroupAddon align="inline-end">
            <Tooltip>
              <TooltipTrigger asChild>
                <InputGroupButton className="rounded-full" size="icon-xs" aria-label="Info">
                  <IconInfoCircle />
                </InputGroupButton>
              </TooltipTrigger>
              <TooltipContent>This is content in a tooltip.</TooltipContent>
            </Tooltip>
          </InputGroupAddon>
        </InputGroup>
        <Field>
          <Label htmlFor="input-secure-19" className="sr-only">
            Input Secure
          </Label>
          <InputGroup>
            <InputGroupInput id="input-secure-19" className="pl-0.5!" />
            <Popover>
              <PopoverTrigger asChild>
                <InputGroupAddon>
                  <InputGroupButton variant="outline" size="icon-xs" aria-label="Info">
                    <IconInfoCircle />
                  </InputGroupButton>
                </InputGroupAddon>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                alignOffset={10}
                className="flex flex-col gap-1 rounded-xl text-sm"
              >
                <p className="font-medium">Your connection is not secure.</p>
                <p>You should not enter any sensitive information on this site.</p>
              </PopoverContent>
            </Popover>
            <InputGroupAddon className="text-muted-foreground pl-1!">https://</InputGroupAddon>
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                onClick={() => setIsFavorite(!isFavorite)}
                size="icon-xs"
                aria-label="Favorite"
              >
                <IconStar
                  data-favorite={isFavorite}
                  className="data-[favorite=true]:fill-primary data-[favorite=true]:stroke-primary"
                />
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </Field>
        <ButtonGroup className="w-full">
          <ButtonGroup>
            <Button variant="outline" size="icon" aria-label="Add">
              <IconPlus />
            </Button>
          </ButtonGroup>
          <ButtonGroup className="flex-1">
            <InputGroup>
              <InputGroupInput
                placeholder={voiceEnabled ? "Record and send audio..." : "Send a message..."}
                disabled={voiceEnabled}
              />
              <InputGroupAddon align="inline-end">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <InputGroupButton
                      onClick={() => setVoiceEnabled(!voiceEnabled)}
                      data-active={voiceEnabled}
                      className="data-[active=true]:bg-primary data-[active=true]:text-primary-foreground"
                      aria-pressed={voiceEnabled}
                      size="icon-xs"
                      aria-label="Voice Mode"
                    >
                      <IconWaveSine />
                    </InputGroupButton>
                  </TooltipTrigger>
                  <TooltipContent>Voice Mode</TooltipContent>
                </Tooltip>
              </InputGroupAddon>
            </InputGroup>
          </ButtonGroup>
        </ButtonGroup>
        <InputGroup>
          <InputGroupTextarea placeholder="Ask, Search or Chat..." />
          <InputGroupAddon align="block-end">
            <InputGroupButton
              variant="outline"
              className="style-lyra:rounded-none rounded-full"
              size="icon-xs"
              aria-label="Add"
            >
              <IconPlus />
            </InputGroupButton>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <InputGroupButton variant="ghost">Auto</InputGroupButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="[--radius:0.95rem]">
                <DropdownMenuItem>Auto</DropdownMenuItem>
                <DropdownMenuItem>Agent</DropdownMenuItem>
                <DropdownMenuItem>Manual</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <InputGroupText className="ml-auto">52% used</InputGroupText>
            <Separator orientation="vertical" className="h-4!" />
            <InputGroupButton
              variant="solid"
              className="style-lyra:rounded-none rounded-full"
              size="icon-xs"
            >
              <IconArrowUp />
              <span className="sr-only">Send</span>
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </div>
    </Example>
  )
}

function EmptyAvatarGroup() {
  return (
    <Example title="Empty">
      <Empty className="h-full flex-none border">
        <EmptyHeader>
          <EmptyMedia>
            <AvatarGroup className="grayscale">
              <Avatar size="lg">
                <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
                <AvatarFallback>CN</AvatarFallback>
              </Avatar>
              <Avatar size="lg">
                <AvatarImage src="https://github.com/maxleiter.png" alt="@maxleiter" />
                <AvatarFallback>LR</AvatarFallback>
              </Avatar>
              <Avatar size="lg">
                <AvatarImage src="https://github.com/evilrabbit.png" alt="@evilrabbit" />
                <AvatarFallback>ER</AvatarFallback>
              </Avatar>
            </AvatarGroup>
          </EmptyMedia>
          <EmptyTitle>No Team Members</EmptyTitle>
          <EmptyDescription>Invite your team to collaborate on this project.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <div className="flex gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline">Show Dialog</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete your account and
                    remove your data from our servers.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction>Continue</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button>Connect Mouse</Button>
              </AlertDialogTrigger>
              <AlertDialogContent size="sm">
                <AlertDialogHeader>
                  <AlertDialogMedia>
                    <IconBluetooth />
                  </AlertDialogMedia>
                  <AlertDialogTitle>Allow accessory to connect?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Do you want to allow the USB accessory to connect to this device?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Don&apos;t allow</AlertDialogCancel>
                  <AlertDialogAction>Allow</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </EmptyContent>
      </Empty>
    </Example>
  )
}

function FormExample() {
  return (
    <Example title="Complex Form">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Payment Method</CardTitle>
          <CardDescription>All transactions are secure and encrypted</CardDescription>
        </CardHeader>
        <CardContent>
          <form>
            <FieldGroup>
              <FieldSet>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="checkout-7j9-card-name-43j">Name on Card</FieldLabel>
                    <Input id="checkout-7j9-card-name-43j" placeholder="John Doe" required />
                  </Field>
                  <div className="grid grid-cols-3 gap-4">
                    <Field className="col-span-2">
                      <FieldLabel htmlFor="checkout-7j9-card-number-uw1">Card Number</FieldLabel>
                      <Input
                        id="checkout-7j9-card-number-uw1"
                        placeholder="1234 5678 9012 3456"
                        required
                      />
                      <FieldDescription>Enter your 16-digit number.</FieldDescription>
                    </Field>
                    <Field className="col-span-1">
                      <FieldLabel htmlFor="checkout-7j9-cvv">CVV</FieldLabel>
                      <Input id="checkout-7j9-cvv" placeholder="123" required />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Field>
                      <FieldLabel htmlFor="checkout-7j9-exp-month-ts6">Month</FieldLabel>
                      <Select defaultValue="">
                        <SelectTrigger id="checkout-7j9-exp-month-ts6">
                          <SelectValue placeholder="MM" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectItem value="01">01</SelectItem>
                            <SelectItem value="02">02</SelectItem>
                            <SelectItem value="03">03</SelectItem>
                            <SelectItem value="04">04</SelectItem>
                            <SelectItem value="05">05</SelectItem>
                            <SelectItem value="06">06</SelectItem>
                            <SelectItem value="07">07</SelectItem>
                            <SelectItem value="08">08</SelectItem>
                            <SelectItem value="09">09</SelectItem>
                            <SelectItem value="10">10</SelectItem>
                            <SelectItem value="11">11</SelectItem>
                            <SelectItem value="12">12</SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="checkout-7j9-exp-year-f59">Year</FieldLabel>
                      <Select defaultValue="">
                        <SelectTrigger id="checkout-7j9-exp-year-f59">
                          <SelectValue placeholder="YYYY" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectItem value="2024">2024</SelectItem>
                            <SelectItem value="2025">2025</SelectItem>
                            <SelectItem value="2026">2026</SelectItem>
                            <SelectItem value="2027">2027</SelectItem>
                            <SelectItem value="2028">2028</SelectItem>
                            <SelectItem value="2029">2029</SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                </FieldGroup>
              </FieldSet>
              <FieldSeparator />
              <FieldSet>
                <FieldLegend>Billing Address</FieldLegend>
                <FieldDescription>
                  The billing address associated with your payment.
                </FieldDescription>
                <FieldGroup>
                  <Field orientation="horizontal">
                    <Checkbox id="checkout-7j9-same-as-shipping-wgm" defaultChecked />
                    <FieldLabel htmlFor="checkout-7j9-same-as-shipping-wgm" className="font-normal">
                      Same as shipping address
                    </FieldLabel>
                  </Field>
                </FieldGroup>
              </FieldSet>
              <FieldSeparator />
              <FieldSet>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="checkout-7j9-optional-comments">Comments</FieldLabel>
                    <Textarea
                      id="checkout-7j9-optional-comments"
                      placeholder="Add any additional comments"
                    />
                  </Field>
                </FieldGroup>
              </FieldSet>
              <Field orientation="horizontal">
                <Button type="submit">Submit</Button>
                <Button variant="outline" type="button">
                  Cancel
                </Button>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </Example>
  )
}

const frameworks = ["Next.js", "SvelteKit", "Nuxt.js", "Remix", "Astro"] as const

function SmallFormExample() {
  const [notifications, setNotifications] = React.useState({
    email: true,
    sms: false,
    push: true,
  })
  const [theme, setTheme] = React.useState("light")

  return (
    <Example title="Form">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>User Information</CardTitle>
          <CardDescription>Please fill in your details below</CardDescription>
          <CardAction>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <IconDotsVertical />
                  <span className="sr-only">More options</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="style-maia:w-56 style-mira:w-48 style-nova:w-48 style-vega:w-56 style-lyra:w-48"
              >
                <DropdownMenuGroup>
                  <DropdownMenuLabel>File</DropdownMenuLabel>
                  <DropdownMenuItem>
                    <IconFile />
                    New File
                    <DropdownMenuShortcut>⌘N</DropdownMenuShortcut>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <IconFolder />
                    New Folder
                    <DropdownMenuShortcut>⇧⌘N</DropdownMenuShortcut>
                  </DropdownMenuItem>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <IconFolderOpen />
                      Open Recent
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal>
                      <DropdownMenuSubContent>
                        <DropdownMenuGroup>
                          <DropdownMenuLabel>Recent Projects</DropdownMenuLabel>
                          <DropdownMenuItem>
                            <IconFileCode />
                            Project Alpha
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <IconFileCode />
                            Project Beta
                          </DropdownMenuItem>
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                              <IconDots />
                              More Projects
                            </DropdownMenuSubTrigger>
                            <DropdownMenuPortal>
                              <DropdownMenuSubContent>
                                <DropdownMenuItem>
                                  <IconFileCode />
                                  Project Gamma
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <IconFileCode />
                                  Project Delta
                                </DropdownMenuItem>
                              </DropdownMenuSubContent>
                            </DropdownMenuPortal>
                          </DropdownMenuSub>
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                          <DropdownMenuItem>
                            <IconFolderSearch />
                            Browse...
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                      </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                  </DropdownMenuSub>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <IconDeviceFloppy />
                    Save
                    <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <IconDownload />
                    Export
                    <DropdownMenuShortcut>⇧⌘E</DropdownMenuShortcut>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuLabel>View</DropdownMenuLabel>
                  <DropdownMenuCheckboxItem
                    checked={notifications.email}
                    onCheckedChange={(checked) =>
                      setNotifications({
                        ...notifications,
                        email: checked === true,
                      })
                    }
                  >
                    <IconEye />
                    Show Sidebar
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={notifications.sms}
                    onCheckedChange={(checked) =>
                      setNotifications({
                        ...notifications,
                        sms: checked === true,
                      })
                    }
                  >
                    <IconLayout />
                    Show Status Bar
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <IconPalette />
                      Theme
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal>
                      <DropdownMenuSubContent>
                        <DropdownMenuGroup>
                          <DropdownMenuLabel>Appearance</DropdownMenuLabel>
                          <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
                            <DropdownMenuRadioItem value="light">
                              <IconSun />
                              Light
                            </DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="dark">
                              <IconMoon />
                              Dark
                            </DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="system">
                              <IconDeviceDesktop />
                              System
                            </DropdownMenuRadioItem>
                          </DropdownMenuRadioGroup>
                        </DropdownMenuGroup>
                      </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                  </DropdownMenuSub>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem>
                    <IconHelpCircle />
                    Help & Support
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <IconFileText />
                    Documentation
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem variant="destructive">
                    <IconLogout />
                    Sign Out
                    <DropdownMenuShortcut>⇧⌘Q</DropdownMenuShortcut>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </CardAction>
        </CardHeader>
        <CardContent>
          <form>
            <FieldGroup>
              <div className="grid grid-cols-2 gap-4">
                <Field>
                  <FieldLabel htmlFor="small-form-name">Name</FieldLabel>
                  <Input id="small-form-name" placeholder="Enter your name" required />
                </Field>
                <Field>
                  <FieldLabel htmlFor="small-form-role">Role</FieldLabel>
                  <Select defaultValue="">
                    <SelectTrigger id="small-form-role">
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="developer">Developer</SelectItem>
                        <SelectItem value="designer">Designer</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="small-form-framework">Framework</FieldLabel>
                <Combobox items={frameworks}>
                  <ComboboxInput
                    id="small-form-framework"
                    placeholder="Select a framework"
                    required
                  />
                  <ComboboxContent>
                    <ComboboxEmpty>No frameworks found.</ComboboxEmpty>
                    <ComboboxList>
                      {(item) => (
                        <ComboboxItem key={item} value={item}>
                          {item}
                        </ComboboxItem>
                      )}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
              </Field>
              <Field>
                <FieldLabel htmlFor="small-form-comments">Comments</FieldLabel>
                <Textarea id="small-form-comments" placeholder="Add any additional comments" />
              </Field>
              <Field orientation="horizontal">
                <Button type="submit">Submit</Button>
                <Button variant="outline" type="button">
                  Cancel
                </Button>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </Example>
  )
}

function ObservabilityCard() {
  return (
    <Example title="Card" className="items-center justify-center">
      <Card className="relative w-full max-w-sm overflow-hidden pt-0">
        <div className="bg-primary absolute inset-0 z-30 aspect-video opacity-50 mix-blend-color" />
        <img
          src="https://images.unsplash.com/photo-1604076850742-4c7221f3101b?q=80&w=1887&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
          alt="Photo by mymind on Unsplash"
          title="Photo by mymind on Unsplash"
          className="relative z-20 aspect-video w-full object-cover brightness-60 grayscale"
        />
        <CardHeader>
          <CardTitle>Observability Plus is replacing Monitoring</CardTitle>
          <CardDescription>
            Switch to the improved way to explore your data, with natural language. Monitoring will
            no longer be available on the Pro plan in November, 2025
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button>
            Create Query <IconPlus data-icon="inline-end" />
          </Button>
          <Badge variant="outline" className="ml-auto">
            Warning
          </Badge>
        </CardFooter>
      </Card>
    </Example>
  )
}

export function FieldSlider() {
  const [value, setValue] = useState([200, 800])
  return (
    <Example title="Field Slider">
      <div className="w-full max-w-md">
        <Field>
          <FieldTitle>Price Range</FieldTitle>
          <FieldDescription>
            Set your budget range ($
            <span className="font-medium tabular-nums">{value[0]}</span> -{" "}
            <span className="font-medium tabular-nums">{value[1]}</span>).
          </FieldDescription>
          <Slider
            value={value}
            onValueChange={setValue}
            max={1000}
            min={0}
            step={10}
            className="mt-2 w-full"
            aria-label="Price Range"
          />
        </Field>
      </div>
    </Example>
  )
}

function ItemExample() {
  return (
    <Example title="Item">
      <div className="flex w-full max-w-md flex-col gap-6">
        <Item variant="outline">
          <ItemContent>
            <ItemTitle>Two-factor authentication</ItemTitle>
            <ItemDescription className="text-pretty xl:hidden 2xl:block">
              Verify via email or phone number.
            </ItemDescription>
          </ItemContent>
          <ItemActions>
            <Button size="sm" variant="outline">
              Enable
            </Button>
          </ItemActions>
        </Item>
        <Item variant="outline" size="sm" asChild>
          <a href="#">
            <ItemMedia variant="icon">
              <IconShoppingBag />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>Your order has been shipped.</ItemTitle>
            </ItemContent>
          </a>
        </Item>
      </div>
    </Example>
  )
}

function BadgeExamples() {
  return (
    <Example title="Badge" className="items-center justify-center">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Badge>Primary</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="destructive">Destructive</Badge>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Badge>
            <Spinner data-icon="inline-start" />
            Syncing
          </Badge>
          <Badge variant="secondary">
            <Spinner data-icon="inline-start" />
            Updating
          </Badge>
          <Badge variant="destructive">
            <Spinner data-icon="inline-start" />
            Error
          </Badge>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Badge variant="outline">Outline</Badge>
          <Badge variant="ghost">Ghost</Badge>
          <Badge variant="solid">Solid</Badge>
        </div>
      </div>
    </Example>
  )
}

export function EmptyWithSpinner() {
  return (
    <Example title="Empty with Spinner">
      <Empty className="w-full border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Spinner />
          </EmptyMedia>
          <EmptyTitle>Processing your request</EmptyTitle>
          <EmptyDescription>
            Please wait while we process your request. Do not refresh the page.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <div className="flex gap-2">
            <Button size="sm">Submit</Button>
            <Button variant="secondary" size="sm">
              Cancel
            </Button>
          </div>
        </EmptyContent>
      </Empty>
    </Example>
  )
}

const SHEET_SIDES = ["top", "right", "bottom", "left"] as const

function SheetExample() {
  return (
    <Example title="Sheet">
      <div className="flex gap-2">
        {SHEET_SIDES.map((side) => (
          <Sheet key={side}>
            <SheetTrigger asChild>
              <Button variant="outline" className="flex-1 capitalize">
                {side}
              </Button>
            </SheetTrigger>
            <SheetContent
              side={side}
              className="data-[side=bottom]:max-h-[50vh] data-[side=top]:max-h-[50vh]"
            >
              <SheetHeader>
                <SheetTitle>Edit profile</SheetTitle>
                <SheetDescription>
                  Make changes to your profile here. Click save when you&apos;re done.
                </SheetDescription>
              </SheetHeader>
              <div className="overflow-y-auto px-4 text-sm">
                {Array.from({ length: 10 }).map((_, index) => (
                  <p
                    key={index}
                    className="style-lyra:mb-2 style-lyra:leading-relaxed mb-4 leading-normal"
                  >
                    Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor
                    incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis
                    nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
                    Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu
                    fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in
                    culpa qui officia deserunt mollit anim id est laborum.
                  </p>
                ))}
              </div>
              <SheetFooter>
                <Button type="submit">Save changes</Button>
                <SheetClose asChild>
                  <Button variant="secondary">Cancel</Button>
                </SheetClose>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        ))}
      </div>
    </Example>
  )
}
