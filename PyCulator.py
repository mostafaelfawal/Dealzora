import customtkinter as ctk
import re

# ===== إعدادات التطبيق =====
ctk.set_appearance_mode("Dark")
ctk.set_default_color_theme("dark-blue")

app = ctk.CTk()
app.title("PyCulator | Mostafa Hamdi")
app.geometry("400x550")
app.resizable(False, False)

# ===== متغير لتخزين النص المعروض على الشاشة =====
current_input = ctk.StringVar()

# ===== شاشة العرض =====
display = ctk.CTkEntry(app, textvariable=current_input, font=("Arial", 30),
                       justify="right")
display.grid(row=0, column=0, columnspan=4, sticky="nsew", padx=10, pady=20, ipady=10)

# ===== منطق العمليات =====
def add_to_input(value):
    text = current_input.get()
    
    if value in "+-*/":
        if not text or text[-1] in "+-*/(":
            return
    
    if value == ".":
        tokens = re.split(r'[+\-*/()]', text)
        if "." in tokens[-1]:
            return
    
    if value == "(":
        if text and (text[-1].isdigit() or text[-1] == ")"):
            current_input.set(text + "*" + value)
            return
    elif value == ")":
        if text.count("(") <= text.count(")"):
            return
        if not text or text[-1] in "+-*/(":
            return
    
    current_input.set(text + value)

def clear_input():
    current_input.set("")

def delete_last():
    current_input.set(current_input.get()[:-1])

def calculate():
    try:
        expr = current_input.get()
        while expr and expr[-1] in "+-*/":
            expr = expr[:-1]
        open_parens = expr.count("(") - expr.count(")")
        expr += ")" * open_parens
        result = str(eval(expr))
        current_input.set(result)
    except Exception:
        current_input.set("خطأ")

# ===== تصميم الأزرار =====
buttons = [
    ["C", "DEL", "(", ")"],
    ["7", "8", "9", "/"],
    ["4", "5", "6", "*"],
    ["1", "2", "3", "-"],
    ["0", ".", "=", "+"]
]

# إنشاء الأزرار باستخدام grid
for i, row in enumerate(buttons):
    for j, btn_text in enumerate(row):
        if btn_text == "C":
            btn = ctk.CTkButton(app, text=btn_text, font=("Arial", 20),
                                 fg_color="#D32F2F", hover_color="#B71C1C",
                                 command=clear_input)
        elif btn_text == "DEL":
            btn = ctk.CTkButton(app, text=btn_text, font=("Arial", 20),
                                 fg_color="#FFA000", hover_color="#FF8F00",
                                 command=delete_last)
        elif btn_text == "=":
            btn = ctk.CTkButton(app, text=btn_text, font=("Arial", 20),
                                 fg_color="#1976D2", hover_color="#1565C0",
                                 command=calculate)
        else:
            btn = ctk.CTkButton(app, text=btn_text, font=("Arial", 20),
                                 command=lambda x=btn_text: add_to_input(x))
        btn.grid(row=i+1, column=j, sticky="nsew", padx=5, pady=5)

# ضبط الأعمدة والصفوف لتكون متساوية
for i in range(4):
    app.grid_columnconfigure(i, weight=1)
for i in range(1, 6):
    app.grid_rowconfigure(i, weight=1)

app.mainloop()