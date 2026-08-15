import "./globals.css";
import AuthProvider from "../components/AuthProvider";

export const metadata = {
  title: "rifemotion",
  description: "rifemotion motion graphics and creative studio",
  icons: {
    icon: "/icones/favicon.png",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
