import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from './breadcrumb'

const meta = { title: 'Foundations/Primitives/Breadcrumb', component: Breadcrumb } satisfies Meta<typeof Breadcrumb>
export default meta
type Story = StoryObj<typeof meta>

export const Trail: Story = {
  render: () => <Breadcrumb><BreadcrumbList><BreadcrumbItem><BreadcrumbLink href="#projects">Projects</BreadcrumbLink></BreadcrumbItem><BreadcrumbSeparator /><BreadcrumbItem><BreadcrumbPage>Argo Desktop</BreadcrumbPage></BreadcrumbItem></BreadcrumbList></Breadcrumb>,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('link', { name: 'Projects' })).toHaveAttribute('href', '#projects')
    await expect(canvas.getByText('Argo Desktop')).toHaveAttribute('aria-current', 'page')
  },
}
