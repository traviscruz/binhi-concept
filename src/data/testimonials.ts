export interface TestimonialItem {
  id?: string;
  quote: string;
  author: string;
  role: string;
  event: string;
  stars: number;
  isMock?: boolean;
}

export const TESTIMONIALS_DATA: TestimonialItem[] = [
  {
    quote: "BINHI Concept transformed our debut staging. The line array audio and moving head lights felt like a high-end concert venue!",
    author: "Samantha Rivera (Mock Data)",
    role: "Debutante's Host (Mock Data)",
    event: "18th Birthday Debut (Mock Data)",
    stars: 5,
    isMock: true,
  },
  {
    quote: "Booking online without endless Messenger chats was a game changer. Equipment arrived 2 hours early, pre-checked, and operated by pros.",
    author: "Mark & Clarisse (Mock Data)",
    role: "Newlyweds (Mock Data)",
    event: "Grand Wedding Reception (Mock Data)",
    stars: 5,
    isMock: true,
  },
  {
    quote: "The P3 LED wall was razor sharp for our corporate keynote slides. Flawless execution and zero audio feedback throughout.",
    author: "David Vance (Mock Data)",
    role: "Event Director (Mock Data)",
    event: "Tech Summit 2026 (Mock Data)",
    stars: 5,
    isMock: true,
  },
  {
    quote: "The low-lying fog cloud generator made our first dance look straight out of a fairy tale! Incredible service.",
    author: "Patricia & Carlos (Mock Data)",
    role: "Wedding Hosts (Mock Data)",
    event: "Garden Wedding (Mock Data)",
    stars: 5,
    isMock: true,
  },
  {
    quote: "Seamless gear setup for our 500-guest outdoor festival. Sound coverage was balanced from the front row all the way to the back.",
    author: "Anton & Team (Mock Data)",
    role: "Festival Organizer (Mock Data)",
    event: "Summer Music Fest (Mock Data)",
    stars: 5,
    isMock: true,
  },
];