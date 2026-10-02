import * as docx from 'docx';
import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';

const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableCell,
  TableRow,
  WidthType,
  HeadingLevel,
  AlignmentType,
  ShadingType
} = docx;

// Color Palette
const PRIMARY_COLOR = "1E3A8A"; // Dark Blue
const SECONDARY_COLOR = "0D9488"; // Teal
const ACCENT_BG = "EFF6FF"; // Soft Blue

function createHeaderCell(text, widthPercent = null) {
  return new TableCell({
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text: text,
            bold: true,
            color: "FFFFFF",
            size: 20, // 10pt
            font: "Arial"
          })
        ],
        alignment: AlignmentType.LEFT
      })
    ],
    shading: { fill: PRIMARY_COLOR, type: ShadingType.CLEAR },
    width: widthPercent ? { size: widthPercent, type: WidthType.PERCENTAGE } : undefined
  });
}

function createCell(text, bold = false, background = null, widthPercent = null) {
  const lines = String(text).split('\n');
  const paragraphs = lines.map(line => 
    new Paragraph({
      children: [
        new TextRun({
          text: line,
          bold: bold,
          size: 18, // 9pt
          font: "Arial"
        })
      ]
    })
  );

  return new TableCell({
    children: paragraphs,
    shading: background ? { fill: background, type: ShadingType.CLEAR } : undefined,
    width: widthPercent ? { size: widthPercent, type: WidthType.PERCENTAGE } : undefined
  });
}

const doc = new Document({
  sections: [
    {
      properties: {},
      children: [
        // Title Block
        new Paragraph({
          heading: HeadingLevel.TITLE,
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: "BINHI CONCEPT SOUND & LIGHTS SYSTEM",
              bold: true,
              size: 32,
              color: PRIMARY_COLOR,
              font: "Arial"
            })
          ]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: "Master End-to-End System Workflow & Step-by-Step Testing Guide",
              italic: true,
              size: 22,
              color: SECONDARY_COLOR,
              font: "Arial"
            })
          ]
        }),
        new Paragraph({ text: "", space: { after: 200 } }),

        // System Info Box
        new Paragraph({
          children: [
            new TextRun({ text: "Target Web Application URL: ", bold: true, font: "Arial" }),
            new TextRun({ text: "https://binhiconcept.vercel.app", color: PRIMARY_COLOR, font: "Arial" })
          ]
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "Document Scope: ", bold: true, font: "Arial" }),
            new TextRun({ text: "Complete, sequential end-to-end testing workflow covering registration, auth, verification, profile editing & image uploads, catalog & custom builder, booking, logistics pricing, payment gateways, admin approval, staff assignment, serial unit inventory allocation, rescheduling, cancellation/refunds, crew stage tracking, client sign-off, equipment maintenance, affiliate referrals, loyalty rewards, reviews, and admin audit governance.", font: "Arial" })
          ],
          space: { after: 300 }
        }),

        // 1. Credentials Table
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [
            new TextRun({ text: "1. Master Credentials & Role Access Directory", bold: true, size: 24, color: PRIMARY_COLOR, font: "Arial" })
          ],
          space: { before: 200, after: 100 }
        }),

        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                createHeaderCell("Role Name", 15),
                createHeaderCell("Email Account", 25),
                createHeaderCell("Password Options", 20),
                createHeaderCell("Target Route", 15),
                createHeaderCell("Access Scope & Key Capabilities", 25)
              ]
            }),
            new TableRow({
              children: [
                createCell("System Admin", true, ACCENT_BG),
                createCell("traviscruz2021@gmail.com"),
                createCell("123Travis or 123Traviss"),
                createCell("/admin"),
                createCell("Full administrative control, booking approval, staff assignment, vouchers, financial reports, audit logs")
              ]
            }),
            new TableRow({
              children: [
                createCell("Inventory Manager", true),
                createCell("videogreet123@gmail.com"),
                createCell("123Travis or 123Traviss"),
                createCell("/inventory"),
                createCell("Equipment stock, serial unit allocation, damage/maintenance incident logging, usage reports")
              ]
            }),
            new TableRow({
              children: [
                createCell("Crew Member 1", true, ACCENT_BG),
                createCell("melgrantcruz18@gmail.com"),
                createCell("123Travis or 123Traviss"),
                createCell("/crew"),
                createCell("Assigned event schedules, availability submission, equipment checklists, stage tracking, client sign-off")
              ]
            }),
            new TableRow({
              children: [
                createCell("Crew Member 2", true),
                createCell("appdevdatabase@gmail.com"),
                createCell("123Travis or 123Traviss"),
                createCell("/crew"),
                createCell("Assigned event schedules, availability submission, equipment checklists, stage tracking, client sign-off")
              ]
            }),
            new TableRow({
              children: [
                createCell("Customer 1", true, ACCENT_BG),
                createCell("travisicho@gmail.com"),
                createCell("123Travis or 123Traviss"),
                createCell("/dashboard"),
                createCell("Package/equipment booking, custom builder, checkout (PayMongo/Maya), status tracker, loyalty")
              ]
            }),
            new TableRow({
              children: [
                createCell("Customer 2", true),
                createCell("kopimendoza@gmail.com"),
                createCell("123Travis or 123Traviss"),
                createCell("/dashboard"),
                createCell("Booking history, checkout, reviews submission, loyalty points redemption")
              ]
            }),
            new TableRow({
              children: [
                createCell("Affiliate / Partner", true, ACCENT_BG),
                createCell("ishwomarcaida@gmail.com"),
                createCell("123Travis or 123Traviss"),
                createCell("/partner"),
                createCell("Referral link generation, commission earnings tracking, payout requests")
              ]
            })
          ]
        }),

        new Paragraph({ text: "", space: { after: 300 } }),

        // 2. Sequential Workflow Sections
        new Paragraph({
          children: [
            new TextRun({ text: "2. Sequential Master Testing Workflow (Start to End)", bold: true, size: 24, color: PRIMARY_COLOR, font: "Arial" })
          ],
          space: { before: 200, after: 100 }
        }),

        // Phase 1 Table
        new Paragraph({
          children: [new TextRun({ text: "Phase 1: User Registration, Provisioning & Role Setup", bold: true, size: 20, color: SECONDARY_COLOR, font: "Arial" })],
          space: { before: 100, after: 50 }
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                createHeaderCell("Step #", 8),
                createHeaderCell("Module Name & Route", 22),
                createHeaderCell("Role Account", 20),
                createHeaderCell("Detailed Step-by-Step Test Procedure", 30),
                createHeaderCell("Expected System Verification Output", 20)
              ]
            }),
            new TableRow({
              children: [
                createCell("1.1", true),
                createCell("Customer Self-Registration & OTP\n(/signup -> /otp)"),
                createCell("New Customer / travisicho@gmail.com"),
                createCell("1. Open /signup\n2. Fill Full Name, Phone, Email, Password\n3. Click Register\n4. Input OTP code on /otp page"),
                createCell("Account verified; redirected to /login or /dashboard")
              ]
            }),
            new TableRow({
              children: [
                createCell("1.2", true, ACCENT_BG),
                createCell("Affiliate Partner Application\n(/affiliates)"),
                createCell("Affiliate / ishwomarcaida@gmail.com"),
                createCell("1. Open /affiliates\n2. Click Apply as Partner\n3. Fill details (Name, Email, Phone, Social Channel, GCash)\n4. Submit"),
                createCell("Application saved with 'Pending Approval' status")
              ]
            }),
            new TableRow({
              children: [
                createCell("1.3", true),
                createCell("Admin Staff Provisioning\n(/admin-staff)"),
                createCell("System Admin / traviscruz2021@gmail.com"),
                createCell("1. Log in as Admin -> /admin-staff\n2. Click Add Staff\n3. Provision Inventory Manager & Crew accounts\n4. Set skill tags & salary rates"),
                createCell("Staff accounts created; role permissions active")
              ]
            }),
            new TableRow({
              children: [
                createCell("1.4", true, ACCENT_BG),
                createCell("Admin Partner Review & Approval\n(/admin-affiliates)"),
                createCell("System Admin / traviscruz2021@gmail.com"),
                createCell("1. Open /admin-affiliates\n2. Select pending application (ishwomarcaida@gmail.com)\n3. Set commission rate (e.g. 5%)\n4. Click Approve Application"),
                createCell("Partner approved; referral code (e.g. ISHWO5) generated")
              ]
            })
          ]
        }),

        new Paragraph({ text: "", space: { after: 200 } }),

        // Phase 2 Table
        new Paragraph({
          children: [new TextRun({ text: "Phase 2: Authentication, Recovery & Profile Editing (Image Uploads)", bold: true, size: 20, color: SECONDARY_COLOR, font: "Arial" })],
          space: { before: 100, after: 50 }
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                createHeaderCell("Step #", 8),
                createHeaderCell("Module Name & Route", 22),
                createHeaderCell("Role Account", 20),
                createHeaderCell("Detailed Step-by-Step Test Procedure", 30),
                createHeaderCell("Expected System Verification Output", 20)
              ]
            }),
            new TableRow({
              children: [
                createCell("2.1", true),
                createCell("Multi-Role Login & Security\n(/login, /partner-login)"),
                createCell("All Roles (Admin, Inv, Crew, Cust, Partner)"),
                createCell("1. Test invalid password -> verify error toast\n2. Log in with valid credentials per role"),
                createCell("Correct role-based dashboard displayed")
              ]
            }),
            new TableRow({
              children: [
                createCell("2.2", true, ACCENT_BG),
                createCell("Password Recovery Flow\n(/forgot -> /otp)"),
                createCell("Any Registered User"),
                createCell("1. Open /forgot\n2. Enter email\n3. Input OTP code on /otp\n4. Reset password"),
                createCell("Password updated; login successful with new password")
              ]
            }),
            new TableRow({
              children: [
                createCell("2.3", true),
                createCell("Profile Editing & Avatar Image Uploads\n(/profile, /admin-profile, /inventory-profile, /crew-profile, /partner-profile)"),
                createCell("All Roles"),
                createCell("1. Open role profile page\n2. Edit personal/contact details & GCash payout info\n3. Upload new avatar profile image (.png/.jpg)\n4. Save profile"),
                createCell("Profile updated in database; new avatar image rendered across application headers")
              ]
            })
          ]
        }),

        new Paragraph({ text: "", space: { after: 200 } }),

        // Phase 3 Table
        new Paragraph({
          children: [new TextRun({ text: "Phase 3: Catalog Browsing, Filters, Wishlist & Custom Package Builder", bold: true, size: 20, color: SECONDARY_COLOR, font: "Arial" })],
          space: { before: 100, after: 50 }
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                createHeaderCell("Step #", 8),
                createHeaderCell("Module Name & Route", 22),
                createHeaderCell("Role Account", 20),
                createHeaderCell("Detailed Step-by-Step Test Procedure", 30),
                createHeaderCell("Expected System Verification Output", 20)
              ]
            }),
            new TableRow({
              children: [
                createCell("3.1", true),
                createCell("Landing Page & Package Catalog\n(/landing, /packages)"),
                createCell("Public / Customer"),
                createCell("1. Open /packages\n2. Filter by category (Wedding/Corporate/Concert)\n3. Search package by name\n4. Adjust price slider"),
                createCell("Package cards filter dynamically matching search criteria")
              ]
            }),
            new TableRow({
              children: [
                createCell("3.2", true, ACCENT_BG),
                createCell("Package Details & Inclusions\n(/package-detail)"),
                createCell("Public / Customer"),
                createCell("1. Select package (Package B - Standard Sound & Lights)\n2. View photo carousel & inclusions\n3. Click Heart icon (Add to Wishlist)"),
                createCell("Package specs, inclusions, & crew size displayed; wishlist count increments")
              ]
            }),
            new TableRow({
              children: [
                createCell("3.3", true),
                createCell("Wishlist Management\n(/wishlist)"),
                createCell("Customer"),
                createCell("1. Open /wishlist\n2. View saved items\n3. Click 'Book Now' from wishlist"),
                createCell("Directs user into checkout with wishlist item selected")
              ]
            }),
            new TableRow({
              children: [
                createCell("3.4", true, ACCENT_BG),
                createCell("Custom Package Builder\n(/custom-package)"),
                createCell("Customer"),
                createCell("1. Open /custom-package\n2. Select speaker qty, subwoofers, mixers, lights, fog machine\n3. Select event date & click Checkout"),
                createCell("Real-time total price calculated; customized package passed to checkout")
              ]
            }),
            new TableRow({
              children: [
                createCell("3.5", true),
                createCell("Equipment Catalog & Item Detail\n(/equipment, /item-detail)"),
                createCell("Public / Customer"),
                createCell("1. Open /equipment\n2. Click item (e.g. LED Wall P3.9)\n3. Inspect technical specifications"),
                createCell("Item technical specs, dimensions, & power requirements shown")
              ]
            })
          ]
        }),

        new Paragraph({ text: "", space: { after: 200 } }),

        // Phase 4 Table
        new Paragraph({
          children: [new TextRun({ text: "Phase 4: Booking, Distance Logistics Pricing, Vouchers & Payment Checkout", bold: true, size: 20, color: SECONDARY_COLOR, font: "Arial" })],
          space: { before: 100, after: 50 }
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                createHeaderCell("Step #", 8),
                createHeaderCell("Module Name & Route", 22),
                createHeaderCell("Role Account", 20),
                createHeaderCell("Detailed Step-by-Step Test Procedure", 30),
                createHeaderCell("Expected System Verification Output", 20)
              ]
            }),
            new TableRow({
              children: [
                createCell("4.1", true),
                createCell("Affiliate Referral Tracking\n(/?ref=ISHWO5)"),
                createCell("Customer"),
                createCell("1. Open site via link ?ref=ISHWO5\n2. Verify referral code captured in session"),
                createCell("Referral cookie stored for commission attribution")
              ]
            }),
            new TableRow({
              children: [
                createCell("4.2", true, ACCENT_BG),
                createCell("Event Details & Date Selection\n(/checkout)"),
                createCell("Customer"),
                createCell("1. Select Event Date (e.g. Oct 20, 2026)\n2. Fill Event Name, Contact Person, Mobile Number"),
                createCell("Date availability checked & event details recorded")
              ]
            }),
            new TableRow({
              children: [
                createCell("4.3", true),
                createCell("Logistics & Distance Fee Calculation\n(/checkout)"),
                createCell("Customer"),
                createCell("1. Enter Venue Address (e.g. Clark, Pampanga)\n2. System computes distance from warehouse"),
                createCell("Transport fee auto-calculated (base fee + distance surcharge + night fee)")
              ]
            }),
            new TableRow({
              children: [
                createCell("4.4", true, ACCENT_BG),
                createCell("Voucher Code Validation\n(/checkout)"),
                createCell("Customer"),
                createCell("1. Enter promo code (WELCOME10)\n2. Click Apply Voucher"),
                createCell("Discount percentage deducted from total order sum")
              ]
            }),
            new TableRow({
              children: [
                createCell("4.5", true),
                createCell("Payment Gateway & Order Submission\n(/checkout -> /payment-success)"),
                createCell("Customer"),
                createCell("1. Choose payment method (Full Payment or 50% Downpayment via Maya/PayMongo)\n2. Submit payment"),
                createCell("Booking reference (BNH-2026-8891) generated; receipt emailed; status set to Pending")
              ]
            })
          ]
        }),

        new Paragraph({ text: "", space: { after: 200 } }),

        // Phase 5 Table
        new Paragraph({
          children: [new TextRun({ text: "Phase 5: Admin Booking Approval, Staff Assignment & Serial Unit Allocation", bold: true, size: 20, color: SECONDARY_COLOR, font: "Arial" })],
          space: { before: 100, after: 50 }
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                createHeaderCell("Step #", 8),
                createHeaderCell("Module Name & Route", 22),
                createHeaderCell("Role Account", 20),
                createHeaderCell("Detailed Step-by-Step Test Procedure", 30),
                createHeaderCell("Expected System Verification Output", 20)
              ]
            }),
            new TableRow({
              children: [
                createCell("5.1", true),
                createCell("Admin Dashboard KPIs\n(/admin-dashboard)"),
                createCell("System Admin"),
                createCell("1. Log in as Admin -> /admin-dashboard\n2. Inspect KPI widgets (Revenue, Active Bookings, Pending Approvals)"),
                createCell("Real-time revenue & booking analytics rendered")
              ]
            }),
            new TableRow({
              children: [
                createCell("5.2", true, ACCENT_BG),
                createCell("Booking Approval / Confirmation\n(/admin-bookings)"),
                createCell("System Admin"),
                createCell("1. Open /admin-bookings\n2. Click pending booking BNH-2026-8891\n3. Verify receipt & click Approve"),
                createCell("Booking status changes to 'Confirmed'; customer notified")
              ]
            }),
            new TableRow({
              children: [
                createCell("5.3", true),
                createCell("Manual Offline Booking Creation\n(/admin-manual-booking)"),
                createCell("System Admin"),
                createCell("1. Open /admin-manual-booking\n2. Fill offline client details, venue, date, package, & downpayment\n3. Save"),
                createCell("Manual booking created directly into system with 'Confirmed' status")
              ]
            }),
            new TableRow({
              children: [
                createCell("5.4", true, ACCENT_BG),
                createCell("Crew Assignment to Event\n(/admin-bookings)"),
                createCell("System Admin"),
                createCell("1. Select booking BNH-2026-8891\n2. Click Assign Crew\n3. Select melgrantcruz18 & appdevdatabase\n4. Save"),
                createCell("Crew assigned to booking and event appears on crew dashboards")
              ]
            }),
            new TableRow({
              children: [
                createCell("5.5", true),
                createCell("Inventory Serial Unit Allocation\n(/inventory-units)"),
                createCell("Inventory Manager"),
                createCell("1. Log in as Inventory Manager -> /inventory-units\n2. Select booking BNH-2026-8891\n3. Pick specific equipment serial numbers (SPK-EV-001, SUB-18-004)\n4. Confirm"),
                createCell("Physical equipment serial units reserved/assigned for event dates")
              ]
            })
          ]
        }),

        new Paragraph({ text: "", space: { after: 200 } }),

        // Phase 6 Table
        new Paragraph({
          children: [new TextRun({ text: "Phase 6: Rescheduling, Cancellation & Refund Policy Workflow", bold: true, size: 20, color: SECONDARY_COLOR, font: "Arial" })],
          space: { before: 100, after: 50 }
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                createHeaderCell("Step #", 8),
                createHeaderCell("Module Name & Route", 22),
                createHeaderCell("Role Account", 20),
                createHeaderCell("Detailed Step-by-Step Test Procedure", 30),
                createHeaderCell("Expected System Verification Output", 20)
              ]
            }),
            new TableRow({
              children: [
                createCell("6.1", true),
                createCell("Booking Reschedule Flow\n(/booking-tracker -> /admin-bookings)"),
                createCell("Customer & Admin"),
                createCell("1. Customer opens /booking-tracker -> Request Reschedule -> pick new date\n2. Admin opens /admin-bookings -> Approve Reschedule"),
                createCell("Booking date updated; schedule availability re-validated")
              ]
            }),
            new TableRow({
              children: [
                createCell("6.2", true, ACCENT_BG),
                createCell("Cancellation & Refund Calculation\n(/booking-tracker)"),
                createCell("Customer"),
                createCell("1. Customer clicks Cancel Booking on /booking-tracker\n2. System evaluates cancellation policy rule\n3. Customer inputs GCash refund details & submits"),
                createCell("Eligible refund percentage calculated (>14 days = 100%, 7-14 days = 50%, <7 days = 0%)")
              ]
            }),
            new TableRow({
              children: [
                createCell("6.3", true),
                createCell("Admin Refund Settlement\n(/admin-cancellation-policy)"),
                createCell("System Admin"),
                createCell("1. Admin opens pending cancellation requests\n2. Review refund breakdown\n3. Click Approve Cancellation & Issue Refund"),
                createCell("Booking status set to 'Cancelled & Refunded'; assigned serial units released back to stock")
              ]
            })
          ]
        }),

        new Paragraph({ text: "", space: { after: 200 } }),

        // Phase 7 Table
        new Paragraph({
          children: [new TextRun({ text: "Phase 7: On-Site Crew Execution, Stage Tracking & Client Sign-off", bold: true, size: 20, color: SECONDARY_COLOR, font: "Arial" })],
          space: { before: 100, after: 50 }
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                createHeaderCell("Step #", 8),
                createHeaderCell("Module Name & Route", 22),
                createHeaderCell("Role Account", 20),
                createHeaderCell("Detailed Step-by-Step Test Procedure", 30),
                createHeaderCell("Expected System Verification Output", 20)
              ]
            }),
            new TableRow({
              children: [
                createCell("7.1", true),
                createCell("Crew Dashboard & Schedule\n(/crew-assigned-bookings)"),
                createCell("Crew"),
                createCell("1. Log in as Crew -> /crew-assigned-bookings\n2. Open assigned booking BNH-2026-8891\n3. Inspect venue address, call time, & equipment list"),
                createCell("Event details & location route map displayed")
              ]
            }),
            new TableRow({
              children: [
                createCell("7.2", true, ACCENT_BG),
                createCell("Crew Availability Submission\n(/crew-availability)"),
                createCell("Crew"),
                createCell("1. Open /crew-availability calendar\n2. Toggle days as Available / Unavailable & save"),
                createCell("Availability calendar updated for Admin scheduling")
              ]
            }),
            new TableRow({
              children: [
                createCell("7.3", true),
                createCell("On-Site Equipment Checklist\n(/crew-booking-detail)"),
                createCell("Crew"),
                createCell("1. Open event details\n2. Check off items loaded in transit & unloaded on-site"),
                createCell("Checklist progress bar updates to 100%")
              ]
            }),
            new TableRow({
              children: [
                createCell("7.4", true, ACCENT_BG),
                createCell("Setup & Teardown Stage Tracking\n(/crew-setup-teardown)"),
                createCell("Crew"),
                createCell("1. Toggle stages: In Transit -> Setup -> Soundcheck -> Live -> Teardown"),
                createCell("Real-time stage updates reflected on Customer Tracker & Admin Dashboard")
              ]
            }),
            new TableRow({
              children: [
                createCell("7.5", true),
                createCell("Client On-Site Sign-off\n(/crew-booking-detail)"),
                createCell("Crew & Customer"),
                createCell("1. Open Client Sign-off modal\n2. Record client signature / verbal approval note & finish event"),
                createCell("Booking status set to 'Completed'; loyalty points awarded to customer")
              ]
            })
          ]
        }),

        new Paragraph({ text: "", space: { after: 200 } }),

        // Phase 8 Table
        new Paragraph({
          children: [new TextRun({ text: "Phase 8: Inventory Stock Maintenance & Incident/Damage Logging", bold: true, size: 20, color: SECONDARY_COLOR, font: "Arial" })],
          space: { before: 100, after: 50 }
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                createHeaderCell("Step #", 8),
                createHeaderCell("Module Name & Route", 22),
                createHeaderCell("Role Account", 20),
                createHeaderCell("Detailed Step-by-Step Test Procedure", 30),
                createHeaderCell("Expected System Verification Output", 20)
              ]
            }),
            new TableRow({
              children: [
                createCell("8.1", true),
                createCell("Returned Stock Re-integration\n(/inventory-items)"),
                createCell("Inventory Manager"),
                createCell("1. Inspect returned equipment from completed event\n2. Confirm serial units returned to warehouse"),
                createCell("Equipment returned to available rentable stock")
              ]
            }),
            new TableRow({
              children: [
                createCell("8.2", true, ACCENT_BG),
                createCell("Damaged / Lost Equipment Logging\n(/inventory-maintenance-reports)"),
                createCell("Inventory Manager"),
                createCell("1. Click Log Incident / Maintenance\n2. Select damaged serial unit (MHL-BEAM-003)\n3. Input damage description & estimated repair cost\n4. Submit"),
                createCell("Unit status set to 'Under Repair'; total available rental count decremented")
              ]
            }),
            new TableRow({
              children: [
                createCell("8.3", true),
                createCell("Stock Alerts & Usage Analytics\n(/inventory-alerts, /inventory-reports)"),
                createCell("Inventory Manager"),
                createCell("1. Review low stock / maintenance alerts\n2. Export equipment usage reports"),
                createCell("Overbooking alerts & usage metrics rendered")
              ]
            })
          ]
        }),

        new Paragraph({ text: "", space: { after: 200 } }),

        // Phase 9 Table
        new Paragraph({
          children: [new TextRun({ text: "Phase 9: Affiliate Commission Earnings & Admin Payout Settlement", bold: true, size: 20, color: SECONDARY_COLOR, font: "Arial" })],
          space: { before: 100, after: 50 }
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                createHeaderCell("Step #", 8),
                createHeaderCell("Module Name & Route", 22),
                createHeaderCell("Role Account", 20),
                createHeaderCell("Detailed Step-by-Step Test Procedure", 30),
                createHeaderCell("Expected System Verification Output", 20)
              ]
            }),
            new TableRow({
              children: [
                createCell("9.1", true),
                createCell("Partner Commission Dashboard\n(/partner-dashboard)"),
                createCell("Affiliate / Partner"),
                createCell("1. Log in at /partner-login -> /partner-dashboard\n2. Review referral clicks, completed bookings, & commission balance"),
                createCell("Earned commission breakdown & referral link generator displayed")
              ]
            }),
            new TableRow({
              children: [
                createCell("9.2", true, ACCENT_BG),
                createCell("Partner Payout Request\n(/partner-dashboard)"),
                createCell("Affiliate / Partner"),
                createCell("1. Click Request Payout\n2. Enter payout amount & verify GCash details\n3. Submit"),
                createCell("Payout request submitted with 'Pending Payout' status")
              ]
            }),
            new TableRow({
              children: [
                createCell("9.3", true),
                createCell("Admin Payout Approval & Settlement\n(/admin-affiliates)"),
                createCell("System Admin"),
                createCell("1. Admin opens /admin-affiliates -> Payout Requests\n2. Verify payout details & click Approve & Mark Paid"),
                createCell("Payout status updated to 'Paid'; partner balance cleared")
              ]
            })
          ]
        }),

        new Paragraph({ text: "", space: { after: 200 } }),

        // Phase 10 Table
        new Paragraph({
          children: [new TextRun({ text: "Phase 10: Reviews, Loyalty Rewards & Admin Governance", bold: true, size: 20, color: SECONDARY_COLOR, font: "Arial" })],
          space: { before: 100, after: 50 }
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                createHeaderCell("Step #", 8),
                createHeaderCell("Module Name & Route", 22),
                createHeaderCell("Role Account", 20),
                createHeaderCell("Detailed Step-by-Step Test Procedure", 30),
                createHeaderCell("Expected System Verification Output", 20)
              ]
            }),
            new TableRow({
              children: [
                createCell("10.1", true),
                createCell("Loyalty Points & Voucher Redemption\n(/loyalty)"),
                createCell("Customer"),
                createCell("1. Open /loyalty\n2. Verify points credited from completed booking\n3. Redeem points for discount voucher"),
                createCell("Voucher code generated & saved in customer wallet")
              ]
            }),
            new TableRow({
              children: [
                createCell("10.2", true, ACCENT_BG),
                createCell("Review Submission & Moderation\n(/my-reviews -> /admin-reviews -> /testimonials)"),
                createCell("Customer & Admin"),
                createCell("1. Customer submits 5-star review & photo on /my-reviews\n2. Admin opens /admin-reviews & clicks Approve\n3. View review on /testimonials"),
                createCell("Review published on public testimonials page")
              ]
            }),
            new TableRow({
              children: [
                createCell("10.3", true),
                createCell("Admin Financial Export & Audit Logs\n(/admin-reports, /admin-audit-logs)"),
                createCell("System Admin"),
                createCell("1. Admin opens /admin-reports -> Export Financial Report (CSV/Excel)\n2. Admin opens /admin-audit-logs -> filter by user/action"),
                createCell("Financial data exported; complete tamper-proof audit trail rendered")
              ]
            })
          ]
        })
      ]
    }
  ]
});

// Generate Word Document
const docxPath = path.resolve('c:/Users/melgr/Documents/React/binhiconcept', 'BINHI_Concept_Complete_Testing_Workflow.docx');
Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(docxPath, buffer);
  console.log(`Word Document (.docx) successfully created at: ${docxPath}`);
});

// Update Excel File as well to match 100%
const testAccountsData = [
  ["Role Name", "Email Address", "Password Options", "Portal Route / Page", "Access Scope & Capabilities"],
  ["System Admin", "traviscruz2021@gmail.com", "123Travis or 123Traviss", "/admin", "Full admin control, booking approval, staff assignment, vouchers, financial reports, audit logs"],
  ["Inventory Manager", "videogreet123@gmail.com", "123Travis or 123Traviss", "/inventory", "Equipment stock, serial unit allocation, damage/maintenance incident logging, usage reports"],
  ["Crew Member 1", "melgrantcruz18@gmail.com", "123Travis or 123Traviss", "/crew", "Assigned event schedules, availability submission, equipment checklists, stage tracking, client sign-off"],
  ["Crew Member 2", "appdevdatabase@gmail.com", "123Travis or 123Traviss", "/crew", "Assigned event schedules, availability submission, equipment checklists, stage tracking, client sign-off"],
  ["Customer 1", "travisicho@gmail.com", "123Travis or 123Traviss", "/dashboard", "Package/equipment booking, custom builder, checkout (PayMongo/Maya), status tracker, loyalty"],
  ["Customer 2", "kopimendoza@gmail.com", "123Travis or 123Traviss", "/dashboard", "Booking history, checkout, reviews submission, loyalty points redemption"],
  ["Affiliate / Partner", "ishwomarcaida@gmail.com", "123Travis or 123Traviss", "/partner", "Referral link generation, commission earnings tracking, payout requests"]
];

const masterSequentialWorkflowData = [
  ["Step #", "Phase & Module Name", "Target Route", "Role Account", "Detailed Action / Test Procedure", "Expected Verification Output"],
  [1.1, "Customer Registration & OTP", "/signup -> /otp", "New Customer", "Register full details -> Input OTP code on /otp page", "Account verified; redirected to login/dashboard"],
  [1.2, "Affiliate Partner Application", "/affiliates", "Affiliate", "Fill partner application form with GCash details & submit", "Application saved with 'Pending Approval' status"],
  [1.3, "Admin Staff Provisioning", "/admin-staff", "System Admin", "Create Inventory Manager & Crew accounts with skill tags", "Staff accounts created with active role permissions"],
  [1.4, "Admin Partner Review & Approval", "/admin-affiliates", "System Admin", "Review pending partner application & set commission %", "Partner approved; referral code (e.g. ISHWO5) generated"],
  [2.1, "Multi-Role Login Security", "/login, /partner-login", "All Roles", "Test invalid login -> Log in with valid credentials per role", "User authenticated & redirected to role dashboard"],
  [2.2, "Password Recovery Flow", "/forgot -> /otp", "Any User", "Submit email -> Enter OTP on /otp page -> Set new password", "Password reset successfully; user logs in"],
  [2.3, "Profile Editing & Image Uploads", "/profile (all roles)", "All Roles", "Edit contact info & GCash details -> Upload avatar profile photo", "Profile updated; avatar image rendered across headers"],
  [3.1, "Landing Page & Catalog Browsing", "/landing, /packages", "Public / Customer", "Filter package catalog by category & search keyword", "Package cards filter dynamically matching criteria"],
  [3.2, "Package Inclusions & Specs", "/package-detail", "Public / Customer", "View photos, inclusions, specs -> Click Add to Wishlist", "Package specs displayed; wishlist heart active"],
  [3.3, "Wishlist Management", "/wishlist", "Customer", "View saved items -> Click 'Book Now' from wishlist", "Directs user into checkout with wishlist item selected"],
  [3.4, "Custom Package Builder", "/custom-package", "Customer", "Select speakers, subwoofers, mixers, lights, fog machine -> Proceed", "Real-time total price calculated dynamically"],
  [3.5, "Equipment Catalog & Technical Specs", "/equipment, /item-detail", "Public / Customer", "Browse equipment items -> View technical specifications", "Item dimensions, power needs, & rental rates shown"],
  [4.1, "Affiliate Referral Link Tracking", "/?ref=ISHWO5", "Customer", "Open website via referral link ?ref=ISHWO5", "Referral code captured into session state for attribution"],
  [4.2, "Event Details & Date Selection", "/checkout", "Customer", "Select Event Date -> Fill Event Name, Contact Person, Phone", "Date availability checked & event details saved"],
  [4.3, "Logistics & Distance Fee Calculation", "/checkout", "Customer", "Enter Venue Location / Address (e.g. Clark Freeport)", "Distance & transport fee auto-calculated based on rules"],
  [4.4, "Voucher Code Validation", "/checkout", "Customer", "Enter voucher code (WELCOME10) -> Click Apply", "Discount percentage deducted from grand total"],
  [4.5, "Payment Processing & Order Submission", "/checkout -> /payment-success", "Customer", "Select payment option (Full/Downpayment via Maya/PayMongo) -> Submit", "Booking ref (BNH-2026-8891) generated; receipt emailed"],
  [5.1, "Admin Dashboard Overview & KPIs", "/admin-dashboard", "System Admin", "Log in as Admin -> View revenue & active booking widgets", "Real-time revenue & active booking analytics shown"],
  [5.2, "Booking Approval & Confirmation", "/admin-bookings", "System Admin", "Review pending booking BNH-2026-8891 & click Approve", "Booking status set to Confirmed; customer notified"],
  [5.3, "Manual Offline Booking Creation", "/admin-manual-booking", "System Admin", "Enter walk-in client details, venue, date, package & cash deposit", "Manual booking created directly with Confirmed status"],
  [5.4, "Crew Assignment to Event", "/admin-bookings", "System Admin", "Select confirmed booking -> Assign crew (melgrantcruz18 & appdevdatabase)", "Crew assigned; event rendered on crew dashboards"],
  [5.5, "Inventory Serial Unit Allocation", "/inventory-units", "Inventory Manager", "Select booking -> Assign physical equipment serial numbers", "Serial units reserved/assigned for specific event dates"],
  [6.1, "Booking Reschedule Request & Approval", "/booking-tracker -> /admin-bookings", "Customer & Admin", "Customer requests new date -> Admin approves date change", "Booking date updated; schedule availability re-checked"],
  [6.2, "Cancellation & Automated Refund Policy", "/booking-tracker", "Customer", "Customer requests cancellation -> System calculates refund %", "Eligible refund calculated (>14 days = 100%, 7-14 days = 50%)"],
  [6.3, "Admin Refund Settlement", "/admin-cancellation-policy", "System Admin", "Admin reviews cancellation request & clicks Issue Refund", "Status set to Cancelled & Refunded; serial units released"],
  [7.1, "Crew Dashboard & Schedule View", "/crew-assigned-bookings", "Crew", "Log in as Crew -> View assigned event venue & call time", "Event details & route navigation map displayed"],
  [7.2, "Crew Monthly Availability Submission", "/crew-availability", "Crew", "Open availability calendar -> Toggle available/unavailable days", "Availability calendar updated for Admin scheduling"],
  [7.3, "On-Site Equipment Checklist", "/crew-booking-detail", "Crew", "Check off items loaded in vehicle & unloaded at venue", "Checklist progress counter updates to 100%"],
  [7.4, "Setup & Teardown Stage Tracking", "/crew-setup-teardown", "Crew", "Toggle stages: In Transit -> Setup -> Soundcheck -> Live -> Teardown", "Real-time stage updates shown on Customer Tracker & Admin Panel"],
  [7.5, "Client On-Site Sign-off", "/crew-booking-detail", "Crew & Customer", "Present sign-off screen -> Record client signature/approval", "Booking set to Completed; loyalty points awarded to customer"],
  [8.1, "Returned Stock Re-integration", "/inventory-items", "Inventory Manager", "Inspect returned items -> Confirm serial units back in warehouse", "Equipment stock returned to available status"],
  [8.2, "Damaged / Lost Equipment Logging", "/inventory-maintenance-reports", "Inventory Manager", "Log incident for serial unit -> Set repair cost & description", "Unit marked 'Under Repair'; rentable stock decremented"],
  [8.3, "Inventory Stock Alerts & Analytics", "/inventory-alerts, /inventory-reports", "Inventory Manager", "Review low stock alerts & export equipment usage reports", "Overbooking alerts & usage metrics rendered"],
  [9.1, "Partner Commission Dashboard", "/partner-dashboard", "Affiliate / Partner", "Review referral clicks, completed bookings, & commission total", "Commission breakdown & referral link generator displayed"],
  [9.2, "Partner Payout Request", "/partner-dashboard", "Affiliate / Partner", "Click Request Payout -> Enter payout amount & GCash info", "Payout request submitted with Pending Payout status"],
  [9.3, "Admin Payout Approval & Settlement", "/admin-affiliates", "System Admin", "Review partner payout request & click Approve & Mark Paid", "Payout marked Paid; partner available balance cleared"],
  [10.1, "Loyalty Points & Voucher Redemption", "/loyalty", "Customer", "Verify points credited from event -> Redeem for discount voucher", "Voucher code generated & saved to wallet"],
  [10.2, "Review Submission & Moderation", "/my-reviews -> /admin-reviews", "Customer & Admin", "Customer submits 5-star review -> Admin approves review", "Review published on public Testimonials page"],
  [10.3, "Admin Governance & Financial Export", "/admin-reports, /admin-audit-logs", "System Admin", "Export financial report CSV/Excel -> Review system audit logs", "Financial report exported; full audit trail rendered"]
];

const wb = XLSX.utils.book_new();

const addSheet = (data, name) => {
  const ws = XLSX.utils.aoa_to_sheet(data);
  const colWidths = data[0].map((_, colIdx) => {
    let maxLen = 15;
    data.forEach(row => {
      const cellVal = row[colIdx] ? String(row[colIdx]) : "";
      const firstLine = cellVal.split('\n')[0];
      if (firstLine.length > maxLen) maxLen = firstLine.length;
    });
    return { wch: Math.min(maxLen + 3, 60) };
  });
  ws['!cols'] = colWidths;
  XLSX.utils.book_append_sheet(wb, ws, name);
};

addSheet(testAccountsData, "Test Accounts Directory");
addSheet(masterSequentialWorkflowData, "Master Testing Workflow");

const excelPath = path.resolve('c:/Users/melgr/Documents/React/binhiconcept', 'BINHI_Testing_Workflow_and_Test_Cases.xlsx');
XLSX.writeFile(wb, excelPath);
console.log(`Excel Spreadsheet (.xlsx) successfully updated at: ${excelPath}`);
