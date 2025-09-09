'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Home, 
  Settings, 
  Mail, 
  Bell, 
  Download, 
  Upload, 
  Save, 
  Trash2, 
  Edit, 
  Plus,
  RefreshCw,
  LogOut,
  User
} from 'lucide-react';

export default function ButtonTestPage() {
  const [isLoading, setIsLoading] = useState(false);

  const handleAsyncAction = async () => {
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen p-8 bg-background">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Button States Test</h1>
          <p className="text-muted-foreground">
            Test all button variants, sizes, and interactive states
          </p>
        </div>

        {/* Button Variants */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Button Variants</h2>
          <div className="flex flex-wrap gap-4">
            <Button>Default</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="link">Link</Button>
          </div>
        </section>

        {/* Button Sizes */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Button Sizes</h2>
          <div className="flex flex-wrap items-center gap-4">
            <Button size="sm">Small</Button>
            <Button size="default">Default</Button>
            <Button size="lg">Large</Button>
            <Button size="icon" aria-label="Icon button">
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </section>

        {/* Button States */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Button States</h2>
          <div className="flex flex-wrap gap-4">
            <Button>Normal</Button>
            <Button disabled>Disabled</Button>
            <Button onClick={handleAsyncAction} disabled={isLoading}>
              {isLoading ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save
                </>
              )}
            </Button>
          </div>
        </section>

        {/* Buttons with Icons */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Buttons with Icons</h2>
          <div className="flex flex-wrap gap-4">
            <Button className="gap-2">
              <Home className="h-4 w-4" />
              Home
            </Button>
            <Button variant="outline" className="gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </Button>
            <Button variant="secondary" className="gap-2">
              <Mail className="h-4 w-4" />
              Email
            </Button>
            <Button variant="ghost" className="gap-2">
              <Bell className="h-4 w-4" />
              Notifications
            </Button>
          </div>
        </section>

        {/* Action Buttons */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Action Buttons</h2>
          <div className="flex flex-wrap gap-4">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Create
            </Button>
            <Button variant="outline" className="gap-2">
              <Edit className="h-4 w-4" />
              Edit
            </Button>
            <Button variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Download
            </Button>
            <Button variant="outline" className="gap-2">
              <Upload className="h-4 w-4" />
              Upload
            </Button>
            <Button variant="destructive" className="gap-2">
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </div>
        </section>

        {/* User Menu Button */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">User Menu Button</h2>
          <div className="flex gap-4">
            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-4 w-4" />
              </div>
            </Button>
            <Button variant="ghost" className="gap-2">
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </div>
        </section>

        {/* Focus States Test */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Focus States (Tab to test)</h2>
          <div className="flex flex-wrap gap-4">
            <Button>Tab 1</Button>
            <Button variant="outline">Tab 2</Button>
            <Button variant="secondary">Tab 3</Button>
            <Button variant="ghost">Tab 4</Button>
            <Button size="icon" aria-label="Tab 5">
              <Settings className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Use Tab key to navigate through buttons and verify focus rings are visible
          </p>
        </section>

        {/* Mobile Responsive Test */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Mobile Responsive</h2>
          <div className="flex flex-col sm:flex-row gap-4">
            <Button className="w-full sm:w-auto">Full width on mobile</Button>
            <Button variant="outline" className="w-full sm:w-auto">
              Responsive button
            </Button>
          </div>
        </section>

        {/* Animation Test */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Animation Test</h2>
          <div className="flex gap-4">
            <Button 
              className="transition-all duration-200 hover:scale-105 active:scale-95"
              onClick={() => console.log('Animated button clicked')}
            >
              Hover & Click Animation
            </Button>
            <Button 
              variant="outline"
              className="transition-colors duration-200"
            >
              Color Transition
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}