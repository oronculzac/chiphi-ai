"use client"

import { useState } from "react"
import AuthGuard from "@/components/auth/auth-guard"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  BarChart3,
  Receipt,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  AlertTriangle,
  CreditCard,
  Settings,
  Home,
  FileText,
  Bell,
  Search,
  ChevronDown,
  ChevronUp,
  Eye,
  Edit3,
  Paperclip,
  Brain,
  Globe,
  Languages,
  Tag,
  X,
  Check,
  Mail,
} from "lucide-react"
import { Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts"
import GmailSetupWizard from "@/components/gmail-setup-wizard"

// Sample data
const categoryData = [
  { name: "Food & Dining", value: 1250, color: "hsl(var(--chart-1))" },
  { name: "Transportation", value: 850, color: "hsl(var(--chart-2))" },
  { name: "Shopping", value: 650, color: "hsl(var(--chart-3))" },
  { name: "Utilities", value: 450, color: "hsl(var(--chart-4))" },
  { name: "Entertainment", value: 300, color: "hsl(var(--chart-5))" },
]

const trendData = [
  { day: "1", amount: 45 },
  { day: "5", amount: 78 },
  { day: "10", amount: 120 },
  { day: "15", amount: 95 },
  { day: "20", amount: 140 },
  { day: "25", amount: 110 },
  { day: "30", amount: 165 },
]

const alerts = [
  { id: 1, type: "subscription", title: "Netflix Subscription", amount: "$15.99", status: "recurring" },
  { id: 2, type: "low-confidence", title: "Gas Station Receipt", amount: "$45.20", status: "needs-review" },
  { id: 3, type: "subscription", title: "Spotify Premium", amount: "$9.99", status: "recurring" },
  { id: 4, type: "low-confidence", title: "Restaurant Bill", amount: "$78.50", status: "needs-review" },
]

const transactions = [
  {
    id: 1,
    date: "2024-01-15",
    merchant: "Starbucks Coffee",
    amount: 12.45,
    category: "Food & Dining",
    status: "processed",
    confidence: 95,
    originalText: "STARBUCKS STORE #1234\n123 MAIN ST\nCOFFEE LATTE $4.95\nPASTRY $3.50\nTAX $1.00\nTOTAL $12.45",
    englishText: "Starbucks Store #1234, 123 Main St - Coffee Latte $4.95, Pastry $3.50, Tax $1.00, Total $12.45",
    aiExplanation:
      "This appears to be a coffee shop purchase based on the merchant name 'Starbucks' and itemized coffee and pastry purchases.",
    attachments: ["receipt_001.jpg"],
    suggestedCategories: ["Food & Dining", "Coffee", "Beverages"],
  },
  {
    id: 2,
    date: "2024-01-14",
    merchant: "Shell Gas Station",
    amount: 45.2,
    category: "Transportation",
    status: "needs-review",
    confidence: 78,
    originalText: "SHELL #5678\nGAS PUMP 3\nGALLONS: 12.5\nPRICE/GAL: $3.61\nTOTAL: $45.20",
    englishText: "Shell Gas Station #5678, Pump 3 - 12.5 gallons at $3.61 per gallon, Total $45.20",
    aiExplanation:
      "Gas station purchase identified by Shell branding and fuel-related terminology. Lower confidence due to slightly blurry receipt text.",
    attachments: ["receipt_002.jpg"],
    suggestedCategories: ["Transportation", "Fuel", "Auto"],
  },
  {
    id: 3,
    date: "2024-01-13",
    merchant: "Amazon.com",
    amount: 78.99,
    category: "Shopping",
    status: "processed",
    confidence: 92,
    originalText: "Amazon.com Order #123-456789\nWireless Headphones $78.99\nShipping: FREE\nTotal: $78.99",
    englishText: "Amazon.com Order #123-456789 - Wireless Headphones $78.99, Free Shipping, Total $78.99",
    aiExplanation:
      "Online purchase from Amazon marketplace, clearly identified by order number format and merchant branding.",
    attachments: ["receipt_003.pdf"],
    suggestedCategories: ["Shopping", "Electronics", "Online"],
  },
  {
    id: 4,
    date: "2024-01-12",
    merchant: "Netflix",
    amount: 15.99,
    category: "Entertainment",
    status: "processed",
    confidence: 98,
    originalText: "NETFLIX.COM\nMonthly Subscription\nPlan: Standard\n$15.99",
    englishText: "Netflix.com Monthly Subscription - Standard Plan $15.99",
    aiExplanation:
      "Recurring subscription payment to Netflix streaming service, identified by merchant name and subscription terminology.",
    attachments: [],
    suggestedCategories: ["Entertainment", "Subscriptions", "Streaming"],
  },
  {
    id: 5,
    date: "2024-01-11",
    merchant: "Local Restaurant",
    amount: 67.5,
    category: "Food & Dining",
    status: "needs-review",
    confidence: 65,
    originalText: "RESTAURANT BILL\nTABLE 12\nAPPETIZER $12.00\nENTREE $35.00\nDESSERT $8.50\nTIP $12.00\nTOTAL $67.50",
    englishText: "Restaurant Bill Table 12 - Appetizer $12.00, Entree $35.00, Dessert $8.50, Tip $12.00, Total $67.50",
    aiExplanation:
      "Restaurant dining expense based on itemized food categories and tip amount. Lower confidence due to generic merchant name.",
    attachments: ["receipt_004.jpg"],
    suggestedCategories: ["Food & Dining", "Restaurant", "Dining Out"],
  },
]

export default function Dashboard() {
  const [activeNav, setActiveNav] = useState("receipts")
  const [selectedTransaction, setSelectedTransaction] = useState(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [sortField, setSortField] = useState("date")
  const [sortDirection, setSortDirection] = useState("desc")
  const [showOriginal, setShowOriginal] = useState(false)
  const [editingCategory, setEditingCategory] = useState(false)
  const [newCategory, setNewCategory] = useState("")
  const [showGmailWizard, setShowGmailWizard] = useState(false)

  const filteredTransactions = transactions
    .filter((transaction) => {
      const matchesSearch =
        transaction.merchant.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.category.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesStatus = statusFilter === "all" || transaction.status === statusFilter
      const matchesCategory = categoryFilter === "all" || transaction.category === categoryFilter
      return matchesSearch && matchesStatus && matchesCategory
    })
    .sort((a, b) => {
      const aValue = a[sortField]
      const bValue = b[sortField]
      const direction = sortDirection === "asc" ? 1 : -1

      if (sortField === "amount") {
        return (aValue - bValue) * direction
      }
      if (sortField === "date") {
        return (new Date(aValue) - new Date(bValue)) * direction
      }
      return aValue.localeCompare(bValue) * direction
    })

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("desc")
    }
  }

  const getConfidenceBadge = (confidence) => {
    if (confidence >= 90) return <Badge className="bg-green-100 text-green-800">High</Badge>
    if (confidence >= 70) return <Badge className="bg-yellow-100 text-yellow-800">Medium</Badge>
    return <Badge className="bg-red-100 text-red-800">Low</Badge>
  }

  const getStatusBadge = (status) => {
    if (status === "processed") return <Badge className="bg-green-100 text-green-800">Processed</Badge>
    return <Badge variant="destructive">Needs Review</Badge>
  }

  const renderTransactionsTable = () => (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search transactions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="processed">Processed</SelectItem>
            <SelectItem value="needs-review">Needs Review</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filter by category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="Food & Dining">Food & Dining</SelectItem>
            <SelectItem value="Transportation">Transportation</SelectItem>
            <SelectItem value="Shopping">Shopping</SelectItem>
            <SelectItem value="Entertainment">Entertainment</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Transactions Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-border">
                <tr className="text-left">
                  <th className="p-4 font-medium text-muted-foreground">
                    <button
                      onClick={() => handleSort("date")}
                      className="flex items-center gap-1 hover:text-foreground"
                    >
                      Date
                      {sortField === "date" &&
                        (sortDirection === "asc" ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        ))}
                    </button>
                  </th>
                  <th className="p-4 font-medium text-muted-foreground">
                    <button
                      onClick={() => handleSort("merchant")}
                      className="flex items-center gap-1 hover:text-foreground"
                    >
                      Merchant
                      {sortField === "merchant" &&
                        (sortDirection === "asc" ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        ))}
                    </button>
                  </th>
                  <th className="p-4 font-medium text-muted-foreground">
                    <button
                      onClick={() => handleSort("amount")}
                      className="flex items-center gap-1 hover:text-foreground"
                    >
                      Amount
                      {sortField === "amount" &&
                        (sortDirection === "asc" ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        ))}
                    </button>
                  </th>
                  <th className="p-4 font-medium text-muted-foreground">Category</th>
                  <th className="p-4 font-medium text-muted-foreground">Confidence</th>
                  <th className="p-4 font-medium text-muted-foreground">Status</th>
                  <th className="p-4 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((transaction) => (
                  <tr
                    key={transaction.id}
                    className="border-b border-border hover:bg-muted/50 cursor-pointer"
                    onClick={() => setSelectedTransaction(transaction)}
                  >
                    <td className="p-4 text-sm">{new Date(transaction.date).toLocaleDateString()}</td>
                    <td className="p-4">
                      <div className="font-medium">{transaction.merchant}</div>
                    </td>
                    <td className="p-4 font-semibold">${transaction.amount.toFixed(2)}</td>
                    <td className="p-4">
                      <Badge variant="outline">{transaction.category}</Badge>
                    </td>
                    <td className="p-4">{getConfidenceBadge(transaction.confidence)}</td>
                    <td className="p-4">{getStatusBadge(transaction.status)}</td>
                    <td className="p-4">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedTransaction(transaction)
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Transaction Detail Drawer */}
      <Sheet open={!!selectedTransaction} onOpenChange={() => setSelectedTransaction(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto p-0">
          {selectedTransaction && (
            <>
              <SheetHeader className="px-6 py-6 pb-4 border-b border-border">
                <div className="flex items-start justify-between gap-4">
                  <SheetTitle className="text-xl font-semibold text-foreground">Transaction Details</SheetTitle>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {getConfidenceBadge(selectedTransaction.confidence)}
                    {getStatusBadge(selectedTransaction.status)}
                  </div>
                </div>
              </SheetHeader>

              <div className="px-6 py-6 space-y-8">
                <div className="space-y-6">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-2 block">Merchant</label>
                    <p className="text-2xl font-semibold text-foreground">{selectedTransaction.merchant}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground mb-2 block">Amount</label>
                      <p className="text-xl font-semibold text-foreground">${selectedTransaction.amount.toFixed(2)}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground mb-2 block">Date</label>
                      <p className="text-xl text-foreground">
                        {new Date(selectedTransaction.date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-base font-semibold text-foreground flex items-center gap-2">
                    <Brain className="h-5 w-5 text-primary" />
                    AI Analysis
                  </label>
                  <div className="p-4 bg-muted/50 rounded-lg border">
                    <p className="text-sm leading-relaxed text-foreground">{selectedTransaction.aiExplanation}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-base font-semibold text-foreground">Receipt Text</label>
                    <Tabs
                      value={showOriginal ? "original" : "english"}
                      onValueChange={(value) => setShowOriginal(value === "original")}
                    >
                      <TabsList className="grid w-52 grid-cols-2">
                        <TabsTrigger value="english" className="flex items-center gap-2 text-xs">
                          <Globe className="h-3 w-3" />
                          English
                        </TabsTrigger>
                        <TabsTrigger value="original" className="flex items-center gap-2 text-xs">
                          <Languages className="h-3 w-3" />
                          Original
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg border min-h-[120px]">
                    <pre className="text-sm leading-relaxed whitespace-pre-wrap font-mono text-foreground">
                      {showOriginal ? selectedTransaction.originalText : selectedTransaction.englishText}
                    </pre>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-base font-semibold text-foreground flex items-center gap-2">
                    <Tag className="h-5 w-5 text-primary" />
                    Category
                  </label>
                  {editingCategory ? (
                    <div className="space-y-4">
                      <Input
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value)}
                        placeholder="Enter category name"
                        className="text-base"
                      />
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-3">Suggested categories:</p>
                        <div className="flex flex-wrap gap-2">
                          {selectedTransaction.suggestedCategories.map((category) => (
                            <Button
                              key={category}
                              size="sm"
                              variant="outline"
                              onClick={() => setNewCategory(category)}
                              className="text-sm h-8"
                            >
                              {category}
                            </Button>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-3 pt-2">
                        <Button
                          size="sm"
                          onClick={() => {
                            setEditingCategory(false)
                            setNewCategory("")
                          }}
                          className="flex items-center gap-2"
                        >
                          <Check className="h-4 w-4" />
                          Save Changes
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingCategory(false)
                            setNewCategory("")
                          }}
                          className="flex items-center gap-2"
                        >
                          <X className="h-4 w-4" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border">
                      <Badge variant="outline" className="text-sm px-3 py-1">
                        {selectedTransaction.category}
                      </Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingCategory(true)
                          setNewCategory(selectedTransaction.category)
                        }}
                        className="flex items-center gap-2"
                      >
                        <Edit3 className="h-4 w-4" />
                        Edit
                      </Button>
                    </div>
                  )}
                </div>

                {selectedTransaction.attachments.length > 0 && (
                  <div className="space-y-4">
                    <label className="text-base font-semibold text-foreground flex items-center gap-2">
                      <Paperclip className="h-5 w-5 text-primary" />
                      Attachments ({selectedTransaction.attachments.length})
                    </label>
                    <div className="space-y-3">
                      {selectedTransaction.attachments.map((attachment, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-4 border border-border rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                              <Paperclip className="h-4 w-4 text-primary" />
                            </div>
                            <span className="text-sm font-medium text-foreground">{attachment}</span>
                          </div>
                          <Button size="sm" variant="ghost" className="flex items-center gap-2">
                            <Eye className="h-4 w-4" />
                            Preview
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )

  return (
    <AuthGuard>
      <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className="w-64 bg-sidebar border-r border-sidebar-border">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-8">
            <Receipt className="h-8 w-8 text-primary" />
            <h1 className="text-xl font-semibold text-sidebar-foreground">AI Receipts</h1>
          </div>

          <nav className="space-y-2">
            {[
              { id: "overview", label: "Overview", icon: Home },
              { id: "receipts", label: "Receipts", icon: Receipt },
              { id: "reports", label: "Reports", icon: FileText },
              { id: "settings", label: "Settings", icon: Settings },
            ].map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveNav(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeNav === item.id
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              )
            })}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold text-foreground">
                {activeNav === "receipts" ? "Transactions" : "Dashboard"}
              </h2>
              <p className="text-muted-foreground">
                {activeNav === "receipts"
                  ? "Manage and review your AI-processed receipts"
                  : "Track your expenses with AI-powered insights"}
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowGmailWizard(true)} className="gap-2">
                <Mail className="h-4 w-4" />
                Setup Gmail
              </Button>
              <Button className="gap-2">
                <Bell className="h-4 w-4" />
                Notifications
              </Button>
            </div>
          </div>

          {showGmailWizard && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-background rounded-lg shadow-lg max-h-[90vh] overflow-y-auto">
                <GmailSetupWizard onClose={() => setShowGmailWizard(false)} />
              </div>
            </div>
          )}

          {activeNav === "receipts" ? (
            renderTransactionsTable()
          ) : (
            <>
              {/* KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">MTD Spend</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-foreground">$3,495</div>
                    <div className="flex items-center gap-1 text-sm">
                      <TrendingUp className="h-3 w-3 text-green-500" />
                      <span className="text-green-500">+12.5%</span>
                      <span className="text-muted-foreground">vs last month</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Receipts Processed</CardTitle>
                    <Receipt className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-foreground">127</div>
                    <div className="flex items-center gap-1 text-sm">
                      <TrendingDown className="h-3 w-3 text-red-500" />
                      <span className="text-red-500">-3.2%</span>
                      <span className="text-muted-foreground">vs last month</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Avg Daily Spend</CardTitle>
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-foreground">$116</div>
                    <div className="flex items-center gap-1 text-sm">
                      <TrendingUp className="h-3 w-3 text-green-500" />
                      <span className="text-green-500">+8.1%</span>
                      <span className="text-muted-foreground">vs last month</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      Spending by Category
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <Pie
                          data={categoryData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {categoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => [`$${value}`, "Amount"]} />
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-2 mt-4">
                      {categoryData.map((category, index) => (
                        <div key={index} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: category.color }} />
                            <span className="text-muted-foreground">{category.name}</span>
                          </div>
                          <span className="font-medium">${category.value}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Charts and Alerts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                {/* Category Donut Chart */}
                <Card className="lg:col-span-1">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      Spending by Category
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <Pie
                          data={categoryData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {categoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => [`$${value}`, "Amount"]} />
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-2 mt-4">
                      {categoryData.map((category, index) => (
                        <div key={index} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: category.color }} />
                            <span className="text-muted-foreground">{category.name}</span>
                          </div>
                          <span className="font-medium">${category.value}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* 30-Day Trend */}
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      30-Day Spending Trend
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={trendData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                          <YAxis
                            stroke="hsl(var(--muted-foreground))"
                            fontSize={12}
                            tickFormatter={(value) => `$${value}`}
                          />
                          <Tooltip
                            formatter={(value) => [`$${value}`, "Daily Spend"]}
                            labelFormatter={(label) => `Day ${label}`}
                          />
                          <Line
                            type="monotone"
                            dataKey="amount"
                            stroke="hsl(var(--primary))"
                            strokeWidth={3}
                            dot={{ fill: "hsl(var(--primary))", strokeWidth: 2, r: 4 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Alerts Panel */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    Alerts & Notifications
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {alerts.map((alert) => (
                      <div
                        key={alert.id}
                        className="flex items-center justify-between p-4 border border-border rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          {alert.type === "subscription" ? (
                            <CreditCard className="h-5 w-5 text-primary" />
                          ) : (
                            <AlertTriangle className="h-5 w-5 text-destructive" />
                          )}
                          <div>
                            <p className="font-medium text-foreground">{alert.title}</p>
                            <p className="text-sm text-muted-foreground">
                              {alert.type === "subscription" ? "Recurring subscription" : "Needs manual review"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-foreground">{alert.amount}</span>
                          <Badge variant={alert.status === "recurring" ? "default" : "destructive"}>
                            {alert.status === "recurring" ? "Auto" : "Review"}
                          </Badge>
                          <Button size="sm" variant="outline">
                            {alert.status === "recurring" ? "Manage" : "Review"}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
      </div>
    </AuthGuard>
  )
}
