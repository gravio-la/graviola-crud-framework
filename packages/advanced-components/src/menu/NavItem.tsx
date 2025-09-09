import { Add as AddIcon } from "@mui/icons-material";
import {
  Avatar,
  Chip,
  Divider,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from "@mui/material";
import { useTheme } from "@mui/material";

import { MenuItem } from "./types";

type NavItemProps = {
  item: MenuItem;
  level: number;
  onClick?: () => void;
  open?: boolean;
  onCreateClicked?: (typeName: string) => void;
  onListClicked?: (typeName: string) => void;
};
export const NavItem = ({
  item,
  level,
  onClick,
  open = true,
  onCreateClicked,
  onListClicked,
}: NavItemProps) => {
  const theme = useTheme();

  const Icon = item.icon as React.FC<{ stroke: number; size: string }>;
  const itemIcon = item?.icon ? <Icon stroke={1.5} size="1.3rem" /> : null;

  return (
    <>
      {item.typeName ? (
        <ListItem
          sx={{
            padding: 0,
          }}
        >
          <ListItemButton
            sx={{
              mb: 0.5,
              alignItems: "flex-start",
              backgroundColor: level > 1 ? "transparent !important" : "inherit",
              px: 2.5,
              pl: level > 1 ? "48px" : "24px",
              py: level > 1 ? 1 : 1.25,
              justifyContent: open ? "initial" : "center",
            }}
            onClick={() => onListClicked?.(item.typeName!)}
          >
            {itemIcon && (
              <ListItemIcon
                sx={{ my: "auto", minWidth: !item?.icon ? 18 : 36 }}
              >
                {itemIcon}
              </ListItemIcon>
            )}
            <ListItemText
              primary={
                <Typography variant={"body1"} color="inherit">
                  {item.title}
                </Typography>
              }
              secondary={
                typeof item.caption === "string" && (
                  <Typography
                    variant="caption"
                    sx={{ ...theme.typography.caption }}
                    display="block"
                    gutterBottom
                  >
                    {item.caption}
                  </Typography>
                )
              }
              sx={{
                opacity: open ? 1 : 0,
                transition: theme.transitions.create("opacity", {
                  easing: theme.transitions.easing.sharp,
                  duration: theme.transitions.duration.leavingScreen,
                }),
              }}
            />
          </ListItemButton>
          {onCreateClicked && (
            <>
              <Divider orientation="vertical" variant="middle" flexItem />
              <ListItemButton
                aria-label="create"
                sx={{
                  mb: 0.5,
                  marginRight: 0,
                  py: level > 1 ? 1 : 1.25,
                  width: "fit-content",
                  flexGrow: 0,
                }}
                onClick={() => onCreateClicked(item.typeName!)}
                disabled={item?.readOnly}
              >
                <AddIcon />
              </ListItemButton>
            </>
          )}
        </ListItem>
      ) : (
        <ListItemButton
          disabled={item.disabled}
          sx={{
            // borderRadius: `${customization.borderRadius}px`,
            mb: 0.5,
            alignItems: "flex-start",
            backgroundColor: level > 1 ? "transparent !important" : "inherit",
            px: 2.5,
            py: level > 1 ? 1 : 1.25,
            justifyContent: open ? "initial" : "center",
          }}
          selected={false}
          onClick={() => onClick?.()}
        >
          {itemIcon && (
            <ListItemIcon sx={{ my: "auto", minWidth: !item?.icon ? 18 : 36 }}>
              {itemIcon}
            </ListItemIcon>
          )}
          <ListItemText
            primary={
              <Typography variant={"body1"} color="inherit">
                {item.title}
              </Typography>
            }
            secondary={
              typeof item.caption === "string" && (
                <Typography
                  variant="caption"
                  sx={{ ...theme.typography.caption }}
                  display="block"
                  gutterBottom
                >
                  {item.caption}
                </Typography>
              )
            }
            sx={{
              opacity: open ? 1 : 0,
              transition: theme.transitions.create("opacity", {
                easing: theme.transitions.easing.sharp,
                duration: theme.transitions.duration.leavingScreen,
              }),
            }}
          />
          {item.chip && (
            // @ts-ignore
            <Chip
              color={item.chip.color}
              variant={item.chip.variant}
              size={item.chip.size}
              label={item.chip.label}
              avatar={item.chip.avatar && <Avatar>{item.chip.avatar}</Avatar>}
            />
          )}
        </ListItemButton>
      )}
    </>
  );
};
