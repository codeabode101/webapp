import nodemailer from "nodemailer";
import { env } from "node:process";

export interface EmailContext {
  studentName: string;
  className: string;
  taughtMethods: string;
  needsPractice: string;
  classDescription: string;
  intendedMethods: string;
  stretchMethods: string;
}

export async function sendHomeworkEmail(to: string, name: string, ctx: EmailContext): Promise<boolean> {
  const emailFrom = env.EMAIL_ADDRESS;
  const password = env.EMAIL_PASSWORD;

  if (!emailFrom || !password) {
    console.log("⚠ EMAIL_ADDRESS or EMAIL_PASSWORD not set, skipping email");
    return false;
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: { user: emailFrom, pass: password },
  });

  const body = [
    `Hi ${name},`,
    ``,
    `Your son/daughter completed the ${ctx.className} class. Homework is available at https://app.codeabode.co`,
    ``,
    `Class info:`,
    `Methods taught: ${ctx.taughtMethods}`,
    `What needs practice: ${ctx.needsPractice}`,
    `Class Description: ${ctx.classDescription}`,
    `Methods intended to be taught: ${ctx.intendedMethods}`,
    `Stretch Methods: ${ctx.stretchMethods}`,
    ``,
    `Best,`,
    `Om`,
  ].join("\n");

  try {
    await transporter.sendMail({
      from: `Codeabode <${emailFrom}>`,
      to: `${name} <${to}>`,
      subject: `Assignment Uploaded for ${ctx.studentName}`,
      text: body,
    });
    console.log(`✉️ Email sent to ${name} <${to}>`);
    return true;
  } catch (error) {
    console.error(`Failed to send email to ${to}:`, error instanceof Error ? error.message : String(error));
    return false;
  }
}
