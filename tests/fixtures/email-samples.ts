/**
 * Email Sample Fixtures
 * 
 * Multilingual email samples for testing receipt processing
 * Includes various formats, languages, and edge cases
 */

import { EmailTestData } from '@/lib/types/test-schemas';

// English email samples
export const englishEmailSamples: Record<string, EmailTestData> = {
  starbucksCoffee: {
    messageId: 'starbucks-001@test.com',
    from: 'receipts@starbucks.com',
    to: 'test-primary@chiphi-test.com',
    subject: 'Your Starbucks Receipt',
    textContent: `
Thank you for visiting Starbucks!

Store: Starbucks Coffee #1234
Address: 123 Main St, New York, NY 10001
Date: January 15, 2024 at 2:30 PM

Order Details:
- Grande Latte                    $5.47
- Tax                            $0.48

Total: $5.95
Payment: Visa ending in 1234

Thank you for your business!
    `,
    htmlContent: `
<html>
<body>
<h2>Thank you for visiting Starbucks!</h2>
<p><strong>Store:</strong> Starbucks Coffee #1234</p>
<p><strong>Address:</strong> 123 Main St, New York, NY 10001</p>
<p><strong>Date:</strong> January 15, 2024 at 2:30 PM</p>

<h3>Order Details:</h3>
<ul>
<li>Grande Latte - $5.47</li>
<li>Tax - $0.48</li>
</ul>

<p><strong>Total:</strong> $5.95</p>
<p><strong>Payment:</strong> Visa ending in 1234</p>

<p>Thank you for your business!</p>
</body>
</html>
    `,
    language: 'en',
    expectedCategory: 'Food & Dining',
    expectedMerchant: 'Starbucks Coffee',
    expectedAmount: 5.95,
  },

  wholeFoodsGrocery: {
    messageId: 'wholefoods-001@test.com',
    from: 'receipts@wholefoods.com',
    to: 'test-primary@chiphi-test.com',
    subject: 'Whole Foods Market Receipt',
    textContent: `
WHOLE FOODS MARKET
456 Broadway, New York, NY 10013
Phone: (212) 555-0123

Date: 01/14/2024 Time: 4:45 PM
Cashier: Sarah M.

ORGANIC BANANAS         $3.99
ALMOND MILK 32OZ        $4.49
QUINOA SALAD           $12.99
KOMBUCHA GT'S          $4.99
AVOCADOS (3)           $5.97

Subtotal:              $32.43
Tax:                   $2.84
Total:                $35.27

VISA ****1234         $35.27

Thank you for shopping with us!
    `,
    language: 'en',
    expectedCategory: 'Groceries',
    expectedMerchant: 'Whole Foods Market',
    expectedAmount: 35.27,
  },

  uberRide: {
    messageId: 'uber-001@test.com',
    from: 'receipts@uber.com',
    to: 'test-primary@chiphi-test.com',
    subject: 'Your Uber Receipt',
    textContent: `
Thanks for riding with Uber!

Trip Details:
From: 123 Main St, New York, NY
To: 789 Park Ave, New York, NY
Date: January 13, 2024 at 6:15 PM
Driver: Michael S.

Fare Breakdown:
Base Fare:             $2.55
Time & Distance:       $8.42
Booking Fee:           $2.75
Subtotal:             $13.72
Tax:                   $1.23
Total:                $14.95

Payment: Visa ****5678

Rate your trip and tip your driver in the app.
    `,
    language: 'en',
    expectedCategory: 'Transportation',
    expectedMerchant: 'Uber',
    expectedAmount: 14.95,
  },
};

// Spanish email samples
export const spanishEmailSamples: Record<string, EmailTestData> = {
  restaurantReceipt: {
    messageId: 'restaurant-es-001@test.com',
    from: 'recibos@elpatio.es',
    to: 'test-multilingual@chiphi-test.com',
    subject: 'Recibo de Restaurante El Patio',
    textContent: `
RESTAURANTE EL PATIO
Calle Mayor 45, Madrid, España
Teléfono: +34 91 555 0123

Fecha: 13/01/2024 Hora: 21:30
Camarero: Carlos R.

PAELLA VALENCIANA       €18.50
SANGRÍA (1L)           €12.00
PAN CON TOMATE          €4.50
FLAN CASERO             €5.60

Subtotal:              €40.60
IVA (10%):              €4.06
Total:                 €44.66

VISA ****9012          €44.66

¡Gracias por su visita!
    `,
    language: 'es',
    expectedCategory: 'Food & Dining',
    expectedMerchant: 'Restaurante El Patio',
    expectedAmount: 44.66,
  },

  pharmacyReceipt: {
    messageId: 'pharmacy-es-001@test.com',
    from: 'recibos@farmacia.es',
    to: 'test-multilingual@chiphi-test.com',
    subject: 'Recibo Farmacia San Miguel',
    textContent: `
FARMACIA SAN MIGUEL
Av. de la Constitución 12, Sevilla
Tel: +34 95 555 0456

Fecha: 12/01/2024 Hora: 10:15
Farmacéutico: Dr. López

IBUPROFENO 600MG        €8.45
VITAMINA C              €12.30
CREMA SOLAR SPF50       €15.99

Subtotal:              €36.74
IVA (4%):               €1.47
Total:                 €38.21

MASTERCARD ****3456    €38.21

Cuide su salud. ¡Hasta pronto!
    `,
    language: 'es',
    expectedCategory: 'Health & Medical',
    expectedMerchant: 'Farmacia San Miguel',
    expectedAmount: 38.21,
  },
};

// French email samples
export const frenchEmailSamples: Record<string, EmailTestData> = {
  cafeReceipt: {
    messageId: 'cafe-fr-001@test.com',
    from: 'recu@cafedeflore.fr',
    to: 'test-multilingual@chiphi-test.com',
    subject: 'Reçu Café de Flore',
    textContent: `
CAFÉ DE FLORE
172 Boulevard Saint-Germain, Paris
Tél: +33 1 45 48 55 26

Date: 11/01/2024 Heure: 15:45
Serveur: Pierre M.

CAFÉ EXPRESSO           €3.50
CROISSANT AUX AMANDES   €4.80
EAU MINÉRALE           €2.50

Sous-total:            €10.80
TVA (20%):              €2.16
Total:                 €12.96

VISA ****7890          €12.96

Merci de votre visite!
    `,
    language: 'fr',
    expectedCategory: 'Food & Dining',
    expectedMerchant: 'Café de Flore',
    expectedAmount: 12.96,
  },

  pharmacieReceipt: {
    messageId: 'pharmacie-fr-001@test.com',
    from: 'recu@pharmacie.fr',
    to: 'test-multilingual@chiphi-test.com',
    subject: 'Reçu Pharmacie de la Paix',
    textContent: `
PHARMACIE DE LA PAIX
25 Rue de la Paix, Lyon
Tél: +33 4 78 55 0123

Date: 10/01/2024 Heure: 14:20
Pharmacien: Dr. Dubois

DOLIPRANE 1000MG        €4.50
SIROP POUR LA TOUX      €8.90
PANSEMENTS             €3.20

Sous-total:            €16.60
TVA (2.1%):             €0.35
Total:                 €16.95

MASTERCARD ****2468    €16.95

Prenez soin de vous!
    `,
    language: 'fr',
    expectedCategory: 'Health & Medical',
    expectedMerchant: 'Pharmacie de la Paix',
    expectedAmount: 16.95,
  },
};

// Japanese email samples
export const japaneseEmailSamples: Record<string, EmailTestData> = {
  convenienceStore: {
    messageId: 'seven-jp-001@test.com',
    from: 'receipt@7-eleven.co.jp',
    to: 'test-multilingual@chiphi-test.com',
    subject: 'セブンイレブン レシート',
    textContent: `
セブン-イレブン 新宿東口店
〒160-0022 東京都新宿区新宿3-1-1
TEL: 03-1234-5678

日時: 2024/01/09 14:30
レジ: 田中

おにぎり（鮭）         ¥120
お茶（緑茶）          ¥150
サンドイッチ          ¥280
コーヒー（ホット）      ¥100

小計:                ¥650
消費税:               ¥65
合計:                ¥715

VISA ****1357        ¥715

ありがとうございました！
    `,
    language: 'ja',
    expectedCategory: 'Shopping',
    expectedMerchant: 'セブンイレブン',
    expectedAmount: 715,
  },

  restaurant: {
    messageId: 'sushi-jp-001@test.com',
    from: 'receipt@sushizen.co.jp',
    to: 'test-multilingual@chiphi-test.com',
    subject: '寿司善 お会計',
    textContent: `
寿司善
〒104-0061 東京都中央区銀座4-2-15
TEL: 03-9876-5432

日時: 2024/01/08 19:45
担当: 佐藤

特上寿司セット        ¥3,500
味噌汁              ¥200
茶碗蒸し            ¥400
ビール（中瓶）        ¥600

小計:              ¥4,700
消費税:             ¥470
合計:              ¥5,170

MASTERCARD ****9753  ¥5,170

またのお越しをお待ちしております。
    `,
    language: 'ja',
    expectedCategory: 'Food & Dining',
    expectedMerchant: '寿司善',
    expectedAmount: 5170,
  },
};

// German email samples
export const germanEmailSamples: Record<string, EmailTestData> = {
  gasStation: {
    messageId: 'shell-de-001@test.com',
    from: 'beleg@shell.de',
    to: 'test-multilingual@chiphi-test.com',
    subject: 'Shell Tankstelle Beleg',
    textContent: `
SHELL TANKSTELLE
Hauptstraße 123, 10115 Berlin
Tel: +49 30 555 0123

Datum: 07.01.2024 Zeit: 16:20
Zapfsäule: 3

SUPER E10 (45.2L)      €65.80
Preis pro Liter:       €1.456

Zwischensumme:         €65.80
MwSt (19%):            €10.51
Gesamtbetrag:          €76.31

VISA ****2345          €76.31

Gute Fahrt!
    `,
    language: 'de',
    expectedCategory: 'Transportation',
    expectedMerchant: 'Shell Tankstelle',
    expectedAmount: 76.31,
  },

  supermarket: {
    messageId: 'rewe-de-001@test.com',
    from: 'beleg@rewe.de',
    to: 'test-multilingual@chiphi-test.com',
    subject: 'REWE Kassenbon',
    textContent: `
REWE MARKT
Berliner Str. 45, 10713 Berlin
Tel: +49 30 555 0789

Datum: 06.01.2024 Zeit: 11:30
Kasse: 2 Kassiererin: Anna

BIO ÄPFEL 1KG          €3.49
VOLLMILCH 1L           €1.29
SCHWARZBROT            €2.99
KÄSE GOUDA 200G        €3.99
JOGHURT NATUR          €0.89

Zwischensumme:         €12.65
MwSt (7%):             €0.62
MwSt (19%):            €1.78
Gesamtbetrag:          €15.05

EC-KARTE ****6789      €15.05

Vielen Dank für Ihren Einkauf!
    `,
    language: 'de',
    expectedCategory: 'Groceries',
    expectedMerchant: 'REWE',
    expectedAmount: 15.05,
  },
};

// Edge case email samples
export const edgeCaseEmailSamples: Record<string, EmailTestData> = {
  malformedReceipt: {
    messageId: 'malformed-001@test.com',
    from: 'broken@test.com',
    to: 'test-primary@chiphi-test.com',
    subject: 'Broken Receipt',
    textContent: `
    INCOMPLETE RECEIPT
    
    Store: Unknown
    Date: ???
    
    Item 1: $
    Item 2: 
    
    Total: ERROR
    Payment: 
    `,
    language: 'en',
    expectedCategory: 'Other',
    expectedMerchant: 'Unknown',
    expectedAmount: 0,
  },

  duplicateReceipt: {
    messageId: 'duplicate-001@test.com',
    from: 'receipts@starbucks.com',
    to: 'test-primary@chiphi-test.com',
    subject: 'Your Starbucks Receipt',
    textContent: `
Thank you for visiting Starbucks!

Store: Starbucks Coffee #1234
Address: 123 Main St, New York, NY 10001
Date: January 15, 2024 at 2:30 PM

Order Details:
- Grande Latte                    $5.47
- Tax                            $0.48

Total: $5.95
Payment: Visa ending in 1234

Thank you for your business!
    `,
    language: 'en',
    expectedCategory: 'Food & Dining',
    expectedMerchant: 'Starbucks Coffee',
    expectedAmount: 5.95,
  },

  forwardedEmail: {
    messageId: 'forwarded-001@test.com',
    from: 'user@example.com',
    to: 'test-primary@chiphi-test.com',
    subject: 'Fwd: Restaurant Receipt',
    textContent: `
---------- Forwarded message ---------
From: receipts@restaurant.com
Date: Wed, Jan 10, 2024 at 8:30 PM
Subject: Restaurant Receipt

MARIO'S ITALIAN RESTAURANT
789 Little Italy, New York, NY

Date: 01/10/2024 Time: 8:30 PM

SPAGHETTI CARBONARA     $18.95
CAESAR SALAD           $12.50
TIRAMISU               $8.95
WINE (CHIANTI)         $24.00

Subtotal:              $64.40
Tax:                   $5.64
Tip (18%):             $12.60
Total:                 $82.64

AMEX ****4567          $82.64

Grazie!
    `,
    language: 'en',
    expectedCategory: 'Food & Dining',
    expectedMerchant: "Mario's Italian Restaurant",
    expectedAmount: 82.64,
  },

  pdfAttachment: {
    messageId: 'pdf-001@test.com',
    from: 'receipts@hotel.com',
    to: 'test-primary@chiphi-test.com',
    subject: 'Hotel Receipt - PDF Attached',
    textContent: `
Dear Guest,

Thank you for staying with us. Please find your receipt attached as a PDF.

Best regards,
Grand Hotel Management
    `,
    attachments: [{
      filename: 'hotel-receipt.pdf',
      contentType: 'application/pdf',
      size: 15432,
      content: 'JVBERi0xLjQKJcOkw7zDtsO8CjIgMCBvYmoKPDwKL0xlbmd0aCAzIDAgUgo+PgpzdHJlYW0KQlQKL0YxIDEyIFRmCjcyIDcyMCBUZAooSG90ZWwgUmVjZWlwdCkgVGoKRVQKZW5kc3RyZWFtCmVuZG9iago=', // Base64 encoded PDF
    }],
    language: 'en',
    expectedCategory: 'Travel',
    expectedMerchant: 'Grand Hotel',
    expectedAmount: 250.00,
  },

  suspiciousContent: {
    messageId: 'suspicious-001@test.com',
    from: 'hacker@malicious.com',
    to: 'test-security@chiphi-test.com',
    subject: '<script>alert("XSS")</script>Receipt',
    textContent: `
<script>alert('XSS Attack')</script>

FAKE RECEIPT
Store: <img src="x" onerror="alert('XSS')">
Date: javascript:alert('XSS')

Total: $999999.99
Credit Card: 4111-1111-1111-1111 (FULL PAN - SHOULD BE REDACTED)
CVV: 123
SSN: 123-45-6789

DROP TABLE transactions; --

<iframe src="http://malicious.com/steal-data"></iframe>
    `,
    language: 'en',
    expectedCategory: 'Other',
    expectedMerchant: 'Unknown',
    expectedAmount: 0,
  },
};

// All email samples combined
export const allEmailSamples = {
  ...englishEmailSamples,
  ...spanishEmailSamples,
  ...frenchEmailSamples,
  ...japaneseEmailSamples,
  ...germanEmailSamples,
  ...edgeCaseEmailSamples,
} as const;

// Helper functions
export function getEmailSample(key: keyof typeof allEmailSamples): EmailTestData {
  return allEmailSamples[key];
}

export function getEmailSamplesByLanguage(language: string): EmailTestData[] {
  return Object.values(allEmailSamples).filter(sample => sample.language === language);
}

export function getEmailSamplesByCategory(category: string): EmailTestData[] {
  return Object.values(allEmailSamples).filter(sample => sample.expectedCategory === category);
}

export function getRandomEmailSample(): EmailTestData {
  const keys = Object.keys(allEmailSamples);
  const randomKey = keys[Math.floor(Math.random() * keys.length)] as keyof typeof allEmailSamples;
  return allEmailSamples[randomKey];
}

// Export types
export type EmailSampleKey = keyof typeof allEmailSamples;