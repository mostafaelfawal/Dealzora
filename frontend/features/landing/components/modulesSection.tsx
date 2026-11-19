import { MODULE_GROUPS, planFor } from "../config/content";
import { Container, Section, SectionHeading } from "./primitives";
import { Reveal, Stagger, StaggerItem } from "./motion";

/**
 * وحدات البرنامج مجمّعة كما في قائمته الجانبية. كل مجموعة صف عريض:
 * عنوانها ووصفها على جانب، ووحداتها في شبكة على الجانب الآخر.
 */
export function ModulesSection() {
  return (
    <Section id="features" aria-labelledby="features-title">
      <Container className="space-y-14">
        <SectionHeading
          id="features-title"
          index="02"
          eyebrow="المميزات"
          title="كل ما يحتاجه متجرك، مرتّب كما يجري يومك"
          lead="أربعة أقسام تغطي البيع والمخزن والحسابات والإدارة. الوحدات الموسومة بخطة تُفتح من تلك الخطة وما فوقها."
        />

        <div className="border-t">
          {MODULE_GROUPS.map((group, gi) => (
            <Reveal
              as="article"
              key={group.id}
              aria-labelledby={`group-${group.id}`}
              className="grid gap-6 border-b py-10 lg:grid-cols-[16rem_1fr] lg:gap-12"
            >
              <header className="space-y-2 lg:sticky lg:top-24 lg:self-start">
                <p
                  className="font-mono text-xs text-muted-foreground"
                  dir="ltr"
                >
                  {String(gi + 1).padStart(2, "0")} / {MODULE_GROUPS.length}
                </p>
                <h3 id={`group-${group.id}`} className="text-2xl font-bold">
                  {group.label}
                </h3>
                <p className="text-sm leading-7 text-muted-foreground">
                  {group.summary}
                </p>
              </header>

              <Stagger
                as="ul"
                stagger={0.07}
                amount={0.1}
                className="grid gap-px border bg-border sm:grid-cols-2"
              >
                {group.items.map(
                  ({ icon: Icon, title, description, feature }) => {
                    const plan = planFor(feature);
                    return (
                      <StaggerItem
                        as="li"
                        variant="scale"
                        key={title}
                        className="flex flex-col gap-4 bg-background p-6 transition-colors hover:bg-muted/50 sm:last:odd:col-span-2"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <span className="flex size-10 items-center justify-center bg-muted">
                            <Icon className="size-5" aria-hidden />
                          </span>
                          {plan && (
                            <span className="border px-2 py-0.5 text-[11px] text-muted-foreground">
                              من خطة «{plan}»
                            </span>
                          )}
                        </div>
                        <div className="space-y-2">
                          <h4 className="text-base font-semibold">{title}</h4>
                          <p className="text-sm leading-7 text-muted-foreground">
                            {description}
                          </p>
                        </div>
                      </StaggerItem>
                    );
                  },
                )}
              </Stagger>
            </Reveal>
          ))}
        </div>
      </Container>
    </Section>
  );
}
