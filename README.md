# ChiPhi AI - Email Receipt Processing System

An intelligent, multilingual receipt processing system that automatically translates, extracts, and categorizes financial data from receipt emails with explainable AI insights.

## 🚀 Features

- **Email-first processing**: Forward receipts to unique private email aliases
- **Multilingual support**: Automatic translation from any language to English
- **AI-powered extraction**: Structured JSON extraction with confidence scoring
- **Learning system**: Improves categorization accuracy from user corrections
- **Explainable AI**: Every transaction includes confidence scores and reasoning
- **Real-time dashboards**: Month-to-date totals, category breakdowns, and spending trends
- **Multi-tenant security**: Row-level security with strict data isolation
- **Export capabilities**: CSV and YNAB-compatible formats

## 🛠 Tech Stack

- **Framework**: Next.js 15.2.4 with App Router
- **Database**: Supabase (PostgreSQL with RLS)
- **AI**: OpenAI GPT-4o-mini for extraction and translation
- **UI**: Tailwind CSS 4 + shadcn/ui components
- **Auth**: Supabase Auth with multi-tenant support
- **Email Processing**: AWS SES + Lambda (Node.js 20.x) + S3
- **Testing**: Playwright + Vitest with comprehensive test coverage
- **Deployment**: AWS Amplify with email infrastructure on AWS
- **Development**: Built with [Kiro AI IDE](https://kiro.ai) 🤖

## 🏗 Architecture

### Email Processing Infrastructure
- **AWS SES**: Receives emails at chiphi.oronculzac.com
- **AWS Lambda**: Parses MIME content with mailparser
- **AWS S3**: Stores raw email content for processing
- **AWS SNS**: Triggers Lambda functions on email arrival

### Provider Abstraction Layer
- Supports multiple email providers (Cloudflare, SES)
- Runtime provider switching for deployment flexibility
- Standardized payload normalization

### AI Processing Pipeline
- Translation → Extraction → Categorization → Learning
- Confidence scoring and explainable decisions
- MerchantMap learning system for improved accuracy

### Security & Monitoring
- HMAC signature verification
- PII redaction (credit cards, 2FA codes)
- Comprehensive logging with correlation IDs
- Multi-tenant data isolation

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Supabase account
- OpenAI API key

### Environment Setup
1. Copy `.env.example` to `.env.local`
2. Fill in your Supabase and OpenAI credentials
3. Configure email provider settings (SES or Cloudflare)
4. Set up AWS infrastructure (see AWS deployment guide)

### Development
```bash
npm install
npm run dev
```

### Testing
```bash
# Unit tests
npm run test:unit

# Integration tests  
npm run test:integration

# End-to-end tests
npm run test:e2e

# Full test suite
npm run test:comprehensive
```

## 📊 Dashboard Features

- Real-time transaction processing
- Category-based spending analysis
- Monthly/yearly reporting
- Budget tracking and alerts
- Export to CSV/YNAB formats
- Advanced analytics with trends

## 🔒 Security

- Row Level Security (RLS) for multi-tenant isolation
- HMAC webhook verification
- PAN redaction for credit card security
- Rate limiting per organization
- Comprehensive audit logging

## 🌍 Multilingual Support

Supports receipt processing in:
- English, Spanish, French, German
- Japanese, Chinese, Korean
- And many more languages with automatic translation

## 📈 Performance

- Optimized database queries with proper indexing
- Connection pooling for scalability
- Caching for merchant categorization
- Batch processing for high-volume scenarios

## 🧪 Testing Strategy

- **Unit**: Individual service and utility testing
- **Integration**: Database operations and API endpoints
- **E2E**: Complete user workflows with Playwright
- **MCP**: Model Context Protocol server integrations
- **Visual**: UI regression testing
- **Performance**: Load testing and optimization

## 📚 Documentation

- [API Documentation](docs/)
- [AWS Deployment Guide](.kiro/steering/aws-deployment.md)
- [Testing Guide](docs/testing-guide.md)
- [Email Provider Setup](lib/inbound/README.md)
- [Performance Optimizations](docs/performance-optimizations.md)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Run the test suite
4. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

For issues and questions:
- Check the [documentation](docs/)
- Review [test examples](tests/)
- Open an issue on GitHub

---

**Developed with [Kiro AI IDE](https://kiro.ai)** 🤖 - The AI-powered development environment

Built with ❤️ using Next.js, Supabase, OpenAI, and AWS