export interface TestimonialItem {
  id?: string;
  quote: string;
  author: string;
  role: string;
  event: string;
  stars: number;
}

export const TESTIMONIALS_DATA: TestimonialItem[] = [
  {
    quote: "BINHI Concept transformed our debut staging. The line array audio and moving head lights felt like a high-end concert venue!",
    author: "Samantha Rivera",
    role: "Debutante's Host",
    event: "18th Birthday Debut",
    stars: 5,
  },
  {
    quote: "Booking online without endless Messenger chats was a game changer. Equipment arrived 2 hours early, pre-checked, and operated by pros.",
    author: "Mark & Clarisse",
    role: "Newlyweds",
    event: "Grand Wedding Reception",
    stars: 5,
  },
  {
    quote: "The P3 LED wall was razor sharp for our corporate keynote slides. Flawless execution and zero audio feedback throughout.",
    author: "David Vance",
    role: "Event Director",
    event: "Tech Summit 2026",
    stars: 5,
  },
  {
    quote: "The low-lying fog cloud generator made our first dance look straight out of a fairy tale! Incredible service.",
    author: "Patricia & Carlos",
    role: "Wedding Hosts",
    event: "Garden Wedding",
    stars: 5,
  },
  {
    quote: "Seamless gear setup for our 500-guest outdoor festival. Sound coverage was balanced from the front row all the way to the back.",
    author: "Anton & Team",
    role: "Festival Organizer",
    event: "Summer Music Fest",
    stars: 5,
  },
];