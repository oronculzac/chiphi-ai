import { SimpleStyleProbes } from './components/simple-style-probes';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

export default function DebugPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Diagnostic Debug Center</h1>
          <p className="text-muted-foreground">
            Comprehensive style testing and component integrity verification with MCP integration
          </p>
        </div>
        <Badge variant="outline" className="text-sm">
          MCP-Integrated
        </Badge>
      </div>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>Style Probes & MCP Integration</CardTitle>
          <CardDescription>
            Test core UI components with computed style verification using shadcn MCP and Playwright MCP
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SimpleStyleProbes />
        </CardContent>
      </Card>
    </div>
  );
}