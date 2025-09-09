'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Settings, 
  User, 
  Mail, 
  Bell, 
  Home,
  ChevronDown,
  X
} from 'lucide-react';

export default function KeyboardNavigationTest() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: '',
    notifications: false,
    theme: 'light'
  });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const firstInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form submitted:', formData);
    alert('Form submitted! Check console for data.');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Test custom keyboard shortcuts
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 'k':
          e.preventDefault();
          alert('Ctrl/Cmd + K pressed - Search shortcut');
          break;
        case '/':
          e.preventDefault();
          firstInputRef.current?.focus();
          break;
      }
    }
    
    if (e.key === 'Escape') {
      setIsDialogOpen(false);
    }
  };

  return (
    <div 
      className="min-h-screen p-8 bg-background"
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Keyboard Navigation Test</h1>
          <p className="text-muted-foreground mb-4">
            Test keyboard navigation, focus management, and accessibility features
          </p>
          <div className="text-sm text-muted-foreground space-y-1">
            <p><kbd className="px-2 py-1 bg-muted rounded text-xs">Tab</kbd> - Navigate forward</p>
            <p><kbd className="px-2 py-1 bg-muted rounded text-xs">Shift + Tab</kbd> - Navigate backward</p>
            <p><kbd className="px-2 py-1 bg-muted rounded text-xs">Enter</kbd> - Activate buttons/links</p>
            <p><kbd className="px-2 py-1 bg-muted rounded text-xs">Space</kbd> - Toggle checkboxes/buttons</p>
            <p><kbd className="px-2 py-1 bg-muted rounded text-xs">Escape</kbd> - Close dialogs/dropdowns</p>
            <p><kbd className="px-2 py-1 bg-muted rounded text-xs">Ctrl/Cmd + K</kbd> - Search shortcut</p>
            <p><kbd className="px-2 py-1 bg-muted rounded text-xs">Ctrl/Cmd + /</kbd> - Focus first input</p>
          </div>
        </div>

        {/* Navigation Buttons */}
        <Card>
          <CardHeader>
            <CardTitle>Navigation Buttons</CardTitle>
            <CardDescription>Test tab order and focus states</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <Button>
                <Home className="mr-2 h-4 w-4" />
                Home
              </Button>
              <Button variant="outline">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Button>
              <Button variant="secondary">
                <Mail className="mr-2 h-4 w-4" />
                Mail
              </Button>
              <Button variant="ghost">
                <Bell className="mr-2 h-4 w-4" />
                Notifications
              </Button>
              <Button size="icon" aria-label="User menu">
                <User className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Form Elements */}
        <Card>
          <CardHeader>
            <CardTitle>Form Elements</CardTitle>
            <CardDescription>Test form navigation and input focus</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    ref={firstInputRef}
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter your name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="Enter your email"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  value={formData.message}
                  onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                  placeholder="Enter your message"
                  rows={4}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="notifications"
                  checked={formData.notifications}
                  onCheckedChange={(checked) => 
                    setFormData(prev => ({ ...prev, notifications: checked as boolean }))
                  }
                />
                <Label htmlFor="notifications">Enable notifications</Label>
              </div>

              <div className="space-y-3">
                <Label>Theme Preference</Label>
                <RadioGroup
                  value={formData.theme}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, theme: value }))}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="light" id="light" />
                    <Label htmlFor="light">Light</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="dark" id="dark" />
                    <Label htmlFor="dark">Dark</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="system" id="system" />
                    <Label htmlFor="system">System</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label>Category</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="support">Support</SelectItem>
                    <SelectItem value="feedback">Feedback</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-4">
                <Button type="submit">Submit Form</Button>
                <Button type="button" variant="outline">Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Interactive Components */}
        <Card>
          <CardHeader>
            <CardTitle>Interactive Components</CardTitle>
            <CardDescription>Test dropdowns, dialogs, and tabs</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Dropdown Menu */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Dropdown Menu</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    Options
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem>Profile</DropdownMenuItem>
                  <DropdownMenuItem>Settings</DropdownMenuItem>
                  <DropdownMenuItem>Logout</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Dialog */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Dialog</Label>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button>Open Dialog</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Test Dialog</DialogTitle>
                    <DialogDescription>
                      This dialog tests focus trapping and keyboard navigation.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <Input placeholder="Focus should be trapped here" />
                    <div className="flex gap-2">
                      <Button onClick={() => setIsDialogOpen(false)}>Close</Button>
                      <Button variant="outline">Cancel</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Tabs */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Tabs</Label>
              <Tabs defaultValue="tab1" className="w-full">
                <TabsList>
                  <TabsTrigger value="tab1">Tab 1</TabsTrigger>
                  <TabsTrigger value="tab2">Tab 2</TabsTrigger>
                  <TabsTrigger value="tab3">Tab 3</TabsTrigger>
                </TabsList>
                <TabsContent value="tab1" className="mt-4">
                  <p>Content for Tab 1. Use arrow keys to navigate between tabs.</p>
                </TabsContent>
                <TabsContent value="tab2" className="mt-4">
                  <p>Content for Tab 2. Focus should move properly between tab panels.</p>
                </TabsContent>
                <TabsContent value="tab3" className="mt-4">
                  <p>Content for Tab 3. Test keyboard navigation with arrow keys.</p>
                </TabsContent>
              </Tabs>
            </div>
          </CardContent>
        </Card>

        {/* Focus Management Test */}
        <Card>
          <CardHeader>
            <CardTitle>Focus Management</CardTitle>
            <CardDescription>Test focus restoration and management</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Button 
                onClick={() => {
                  const nextButton = document.querySelector('[data-focus-target]') as HTMLElement;
                  nextButton?.focus();
                }}
              >
                Focus Next Button
              </Button>
              <Button data-focus-target>Target Button</Button>
              <Button 
                onClick={() => {
                  firstInputRef.current?.focus();
                }}
              >
                Focus First Input
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}